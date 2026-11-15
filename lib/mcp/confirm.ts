import "server-only";
import { getBalance } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { priceToolCall } from "@/lib/tools/lookup-credits";
import type { ToolDefinition } from "@/lib/tools/types";
import { hashToken, newToken } from "./auth/tokens";
import type { Prisma } from "@/generated/prisma/client";
import { callHash, CONFIRM_FIELD, CONFIRM_SPEND_TOOL } from "./canonical";

export { CONFIRM_SPEND_TOOL };

export const QUOTE_TTL_MS = 10 * 60 * 1000;

export interface QuoteResult {
  needsConfirmation: true;
  tool: string;
  /** Credits the call will hold. Null when it can't be priced before it runs. */
  credits: number | null;
  balance: number;
  destructive: boolean;
  detail: string;
  confirmToken: string;
  /** Not a secret: the hash of the token. The card and the approval page use it to find the quote. */
  quoteId: string;
  expiresAt: string;
  next: string;
}

/** Where the person said yes or no: through the agent, on the PoliVid card in the chat, or on the PoliVid approval page. */
export type QuoteVia = "agent" | "card" | "page";
export type QuoteOutcome = { kind: "approved"; jobId?: string; via: QuoteVia } | { kind: "declined"; via: QuoteVia };

const parseOutcome = (value: unknown): QuoteOutcome | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const via = record.via === "card" || record.via === "page" ? record.via : "agent";
  if (record.kind === "declined") return { kind: "declined", via };
  if (record.kind === "approved") return { kind: "approved", via, ...(typeof record.jobId === "string" ? { jobId: record.jobId } : {}) };
  return null;
};

/** What to tell an agent about a quote that was already settled, so it doesn't re-quote or start it twice. */
export const settledQuoteMessage = (outcome: QuoteOutcome) => {
  const where = outcome.via === "agent" ? "" : outcome.via === "card" ? " on the PoliVid card" : " in PoliVid";
  if (outcome.kind === "declined") {
    return `The person declined this${where}. Nothing was started or charged. Don't run it unless they ask for it again.`;
  }
  return (
    `The person already approved this${where} and it has started${outcome.jobId ? ` (jobId ${outcome.jobId})` : ""}. ` +
    `Don't start it again. ${outcome.jobId ? `Poll get_video with videoId "${outcome.jobId}".` : "Check list_my_videos for it."}`
  );
};

/** First call of an approval tool: price it and hand back a single-use token. Nothing runs. */
export const quoteToolCall = async (userId: string, definition: ToolDefinition, input: Record<string, unknown>) => {
  const [credits, balance] = await Promise.all([priceToolCall(userId, definition.name, input), getBalance(userId)]);
  // Old quotes are only a record of what was offered. Drop the expired ones as new ones come in.
  void db.spendQuote
    .deleteMany({ where: { userId, expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined);
  const token = newToken("quote");
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
  await db.spendQuote.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      toolName: definition.name,
      inputHash: callHash(definition.name, input),
      input: input as Prisma.InputJsonValue,
      credits: credits ?? -1,
      expiresAt,
    },
  });
  const cost =
    credits === null ? "an amount that can only be known once it runs" : credits === 0 ? "no credits" : `${credits} credits`;
  const what = definition.effects.destructive ? `${definition.title} can't be undone and costs ${cost}` : `${definition.title} costs ${cost}`;
  const detail = definition.approvalDetail?.(input) ?? definition.summary;
  const result: QuoteResult = {
    needsConfirmation: true,
    tool: definition.name,
    credits,
    balance: balance.total,
    destructive: definition.effects.destructive,
    detail,
    confirmToken: token,
    quoteId: hashToken(token),
    expiresAt: expiresAt.toISOString(),
    next:
      `${what}. ${detail} The person has ${balance.total} credits. Tell them this and ask before going on. ` +
      `If they agree, call ${CONFIRM_SPEND_TOOL} with {"${CONFIRM_FIELD}": "${token}"}. That runs exactly what was priced; don't call ${definition.name} again. ` +
      `The token works once, for 10 minutes. Tokens from earlier quotes no longer work. ` +
      `Once it runs you get a jobId; poll get_video with it. ` +
      `The person can also approve or decline with the buttons on the PoliVid card. If they say they did, call ${CONFIRM_SPEND_TOOL} with the same token: it reports what happened and never runs twice.`,
  };
  return result;
};

/** Second call: the token must match this user, this tool, this exact input, and be unused and unexpired. */
export const redeemQuote = async (userId: string, toolName: string, input: Record<string, unknown>, token: string) => {
  const tokenHash = hashToken(token);
  const { count } = await db.spendQuote.updateMany({
    where: {
      tokenHash,
      userId,
      toolName,
      inputHash: callHash(toolName, input),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (count > 0) return { ok: true as const };
  const row = await db.spendQuote.findUnique({ where: { tokenHash }, select: { userId: true, toolName: true, usedAt: true, expiresAt: true, outcome: true } });
  const settled = row && row.userId === userId && row.usedAt ? parseOutcome(row.outcome) : null;
  if (settled) return { ok: false as const, reason: settledQuoteMessage(settled), settled, error: settledQuoteMessage(settled) };
  let reason = "That confirm token is unknown.";
  if (row && row.userId === userId) {
    if (row.toolName !== toolName) reason = `That confirm token was issued for ${row.toolName}.`;
    else if (row.usedAt) reason = "That confirm token was already used.";
    else if (row.expiresAt <= new Date()) reason = "That confirm token expired.";
    else reason = "The arguments changed since the quote.";
  }
  return { ok: false as const, reason, settled: null, error: `${reason} Call ${toolName} again without ${CONFIRM_FIELD} to get a fresh quote.` };
};

/**
 * Claims a quote for confirm_spend or the approval page: marks it used and returns the tool and
 * the exact arguments that were priced. Fails for another user's quote, an expired one, an old
 * quote saved before arguments were stored, or one already settled (then `settled` says how).
 */
export const claimQuoteByHash = async (userId: string, tokenHash: string) => {
  const { count } = await db.spendQuote.updateMany({
    where: { tokenHash, userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  const row = await db.spendQuote.findUnique({
    where: { tokenHash },
    select: { userId: true, toolName: true, input: true, usedAt: true, expiresAt: true, outcome: true },
  });
  const mine = Boolean(row && row.userId === userId);
  if (count === 0 || !row || !mine) {
    const settled = mine && row?.usedAt ? parseOutcome(row.outcome) : null;
    const reason = settled
      ? settledQuoteMessage(settled)
      : !row || !mine
        ? "That confirm token is unknown."
        : row.usedAt
          ? "That confirm token was already used."
          : "That confirm token expired.";
    return { ok: false as const, reason, settled, toolName: mine ? row!.toolName : null, input: mine ? row!.input : null };
  }
  if (!row.input || typeof row.input !== "object" || Array.isArray(row.input)) {
    return { ok: false as const, reason: "That quote is from before confirm_spend existed.", settled: null, toolName: row.toolName, input: null };
  }
  return { ok: true as const, toolName: row.toolName, input: row.input as Record<string, unknown> };
};

export const claimQuote = (userId: string, token: string) => claimQuoteByHash(userId, hashToken(token));

/** Notes what a claimed quote turned into, so a later confirm says "already started" instead of re-quoting. */
export const recordQuoteOutcome = async (tokenHash: string, outcome: QuoteOutcome) => {
  await db.spendQuote.update({ where: { tokenHash }, data: { outcome } }).catch(() => undefined);
};

/** The person said no. Only an open quote can be declined; returns the settled outcome otherwise. */
export const declineQuoteByHash = async (userId: string, tokenHash: string, via: QuoteVia) => {
  const { count } = await db.spendQuote.updateMany({
    where: { tokenHash, userId, usedAt: null },
    data: { usedAt: new Date(), outcome: { kind: "declined", via } },
  });
  if (count > 0) return { ok: true as const };
  const row = await db.spendQuote.findUnique({ where: { tokenHash }, select: { userId: true, outcome: true } });
  if (!row || row.userId !== userId) return { ok: false as const, reason: "That quote is unknown." };
  const settled = parseOutcome(row.outcome);
  return { ok: false as const, reason: settled ? settledQuoteMessage(settled) : "That quote was already used." };
};

/** One quote for the approval page. Null when it isn't this person's. */
export const getQuoteForUser = async (userId: string, tokenHash: string) => {
  const row = await db.spendQuote.findUnique({
    where: { tokenHash },
    select: { userId: true, toolName: true, input: true, credits: true, expiresAt: true, usedAt: true, outcome: true },
  });
  if (!row || row.userId !== userId) return null;
  const input = row.input && typeof row.input === "object" && !Array.isArray(row.input) ? (row.input as Record<string, unknown>) : null;
  return {
    toolName: row.toolName,
    input,
    credits: row.credits < 0 ? null : row.credits,
    expired: row.expiresAt <= new Date(),
    used: Boolean(row.usedAt),
    outcome: parseOutcome(row.outcome),
  };
};
