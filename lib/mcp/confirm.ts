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
  expiresAt: string;
  next: string;
}

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
    expiresAt: expiresAt.toISOString(),
    next:
      `${what}. ${detail} The person has ${balance.total} credits. Tell them this and ask before going on. ` +
      `If they agree, call ${CONFIRM_SPEND_TOOL} with {"${CONFIRM_FIELD}": "${token}"}. That runs exactly what was priced; don't call ${definition.name} again. ` +
      `The token works once, for 10 minutes. Tokens from earlier quotes no longer work. ` +
      `Once it runs you get a jobId; poll get_video with it.`,
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
  const row = await db.spendQuote.findUnique({ where: { tokenHash }, select: { userId: true, toolName: true, usedAt: true, expiresAt: true } });
  let reason = "That confirm token is unknown.";
  if (row && row.userId === userId) {
    if (row.toolName !== toolName) reason = `That confirm token was issued for ${row.toolName}.`;
    else if (row.usedAt) reason = "That confirm token was already used.";
    else if (row.expiresAt <= new Date()) reason = "That confirm token expired.";
    else reason = "The arguments changed since the quote.";
  }
  return { ok: false as const, reason, error: `${reason} Call ${toolName} again without ${CONFIRM_FIELD} to get a fresh quote.` };
};

/**
 * Claims a quote by its token for confirm_spend: marks it used and returns the tool and the exact
 * arguments that were priced. Fails for another user's token, a used or expired one, or an old
 * quote saved before arguments were stored.
 */
export const claimQuote = async (userId: string, token: string) => {
  const tokenHash = hashToken(token);
  const { count } = await db.spendQuote.updateMany({
    where: { tokenHash, userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  const row = await db.spendQuote.findUnique({ where: { tokenHash }, select: { userId: true, toolName: true, input: true, usedAt: true, expiresAt: true } });
  if (count === 0 || !row || row.userId !== userId) {
    const reason = !row || row.userId !== userId
      ? "That confirm token is unknown."
      : row.expiresAt <= new Date()
        ? "That confirm token expired."
        : "That confirm token was already used.";
    return { ok: false as const, reason, toolName: row && row.userId === userId ? row.toolName : null, input: row && row.userId === userId ? row.input : null };
  }
  if (!row.input || typeof row.input !== "object" || Array.isArray(row.input)) {
    return { ok: false as const, reason: "That quote is from before confirm_spend existed.", toolName: row.toolName, input: null };
  }
  return { ok: true as const, toolName: row.toolName, input: row.input as Record<string, unknown> };
};
