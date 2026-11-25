import "server-only";
import { db } from "@/lib/db";
import { bearerFrom, hashToken, TOKEN_PREFIX } from "@/lib/mcp/auth/tokens";
import { checkPartnerSignature } from "./signature";
import { ensurePartnerUser, EXTERNAL_USER_ID } from "./users";

export class PartnerAuthError extends Error {
  constructor(
    readonly code: "unauthorized" | "bad_user" | "bad_signature",
    message: string,
  ) {
    super(message);
    this.name = "PartnerAuthError";
  }
}

export interface PartnerPrincipal {
  partnerId: string;
  brandName: string;
  externalUserId: string;
  /** Our account for that user. Every route acts for this account only. */
  userId: string;
  /** The body exactly as signed, already read. Empty for a GET. */
  rawBody: string;
}

/**
 * Who a partner request acts for. The partner proves itself with its secret and signs the body,
 * the user it names, and the time, so the request can't be changed or replayed. The user id never
 * comes from the body.
 */
export const resolvePartnerRequest = async (request: Request): Promise<PartnerPrincipal> => {
  const secret = bearerFrom(request.headers.get("authorization"));
  if (!secret?.startsWith(TOKEN_PREFIX.partner)) throw new PartnerAuthError("unauthorized", "Missing or wrong partner secret.");
  const partner = await db.partner.findUnique({
    where: { secretHash: hashToken(secret) },
    select: { id: true, brandName: true, active: true },
  });
  if (!partner?.active) throw new PartnerAuthError("unauthorized", "Missing or wrong partner secret.");
  const externalUserId = request.headers.get("x-partner-user")?.trim() ?? "";
  if (!EXTERNAL_USER_ID.test(externalUserId)) throw new PartnerAuthError("bad_user", "Send the user's id in X-Partner-User.");
  const rawBody = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
  const problem = checkPartnerSignature({
    secret,
    timestamp: request.headers.get("x-timestamp"),
    signature: request.headers.get("x-signature"),
    externalUserId,
    rawBody,
  });
  if (problem) throw new PartnerAuthError("bad_signature", problem === "stale" ? "The request is too old. Check the clock and sign it again." : "The signature doesn't match.");
  const userId = await ensurePartnerUser(partner.id, externalUserId);
  return { partnerId: partner.id, brandName: partner.brandName, externalUserId, userId, rawBody };
};
