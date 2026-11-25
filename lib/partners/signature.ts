import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/mcp/auth/tokens";

/** How far a request's timestamp may be from our clock, so a captured request can't be replayed later. */
export const MAX_SKEW_SECONDS = 5 * 60;

/** What the partner signs: the timestamp, the user it acts for, and the exact body bytes. */
export const signingInput = (timestamp: string, externalUserId: string, rawBody: string) => `${timestamp}.${externalUserId}.${rawBody}`;

export const signPartnerRequest = (secret: string, timestamp: string, externalUserId: string, rawBody: string) =>
  createHmac("sha256", secret).update(signingInput(timestamp, externalUserId, rawBody)).digest("hex");

export type SignatureProblem = "missing" | "stale" | "mismatch";

/**
 * Checks a partner request's signature. The secret is the partner's own, so a valid signature proves
 * the partner sent this body, for this user, within the last few minutes.
 */
export const checkPartnerSignature = (input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  externalUserId: string;
  rawBody: string;
  nowSeconds?: number;
}): SignatureProblem | null => {
  if (!input.timestamp || !input.signature) return "missing";
  const sent = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(sent) || Math.abs(now - sent) > MAX_SKEW_SECONDS) return "stale";
  const expected = signPartnerRequest(input.secret, input.timestamp, input.externalUserId, input.rawBody);
  return safeEqual(expected, input.signature.trim().toLowerCase()) ? null : "mismatch";
};

/** Signs a webhook we send a partner: the timestamp and the exact body, with the partner's webhook secret. */
export const signPartnerWebhook = (secret: string, timestamp: string, rawBody: string) =>
  createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
