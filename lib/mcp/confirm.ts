import "server-only";
import { getBalance } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { priceToolCall } from "@/lib/tools/lookup-credits";
import type { ToolDefinition } from "@/lib/tools/types";
import { hashToken, newToken } from "./auth/tokens";
import { callHash, CONFIRM_FIELD } from "./canonical";

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
      credits: credits ?? -1,
      expiresAt,
    },
  });
  const cost =
    credits === null ? "an amount that can only be known once it runs" : credits === 0 ? "no credits" : `${credits} credits`;
  const what = definition.effects.destructive ? `${definition.title} can't be undone and costs ${cost}` : `${definition.title} costs ${cost}`;
  const result: QuoteResult = {
    needsConfirmation: true,
    tool: definition.name,
    credits,
    balance: balance.total,
    destructive: definition.effects.destructive,
    detail: definition.approvalDetail?.(input) ?? definition.summary,
    confirmToken: token,
    expiresAt: expiresAt.toISOString(),
    next:
      `${what}. The person has ${balance.total} credits. Tell them the cost and ask before going on. ` +
      `If they agree, call ${definition.name} again with exactly the same arguments plus "${CONFIRM_FIELD}": "${token}". ` +
      `The token works once, for this exact input, for 10 minutes.`,
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
  return { ok: false as const, error: `${reason} Call ${toolName} again without ${CONFIRM_FIELD} to get a fresh quote.` };
};
