import "server-only";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { rateLimited } from "@/lib/mcp/rate-limit";
import { PartnerAuthError, resolvePartnerRequest, type PartnerPrincipal } from "./auth";
import { PartnerError } from "./errors";

export { PartnerError } from "./errors";

const STATUS: Record<string, number> = {
  unauthorized: 401,
  bad_signature: 401,
  bad_user: 400,
  invalid: 400,
  not_found: 404,
  conflict: 409,
  not_ready: 409,
  insufficient_credits: 402,
  rate_limited: 429,
  error: 500,
};

export const partnerError = (code: keyof typeof STATUS, message: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error: { code, message, ...extra } }, { status: STATUS[code] ?? 500 });

/** Requests one partner user may make a minute. A runaway loop stops here, not at the providers. */
const REQUESTS_PER_MINUTE = 60;

/** The JSON body a partner signed, or an empty object. */
export const jsonBody = (principal: PartnerPrincipal): Record<string, unknown> => {
  if (!principal.rawBody.trim()) return {};
  try {
    const parsed = JSON.parse(principal.rawBody) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new PartnerError("invalid", "The body isn't valid JSON.");
  }
};

type Params = Promise<Record<string, string>>;

/**
 * Wraps a partner route: proves the partner and the user, limits the rate, and turns every failure
 * into a plain error code. Handlers get the principal and return JSON.
 */
export const partnerRoute =
  (handler: (principal: PartnerPrincipal, params: Record<string, string>) => Promise<unknown>, okStatus = 200) =>
  async (request: Request, context: { params: Params }) => {
    let principal: PartnerPrincipal;
    try {
      principal = await resolvePartnerRequest(request);
    } catch (error) {
      if (error instanceof PartnerAuthError) return partnerError(error.code, error.message);
      console.error("Partner request could not be verified", error);
      return partnerError("error", "Something went wrong. Try again.");
    }
    if (rateLimited(`partner:${principal.partnerId}:${principal.externalUserId}`, REQUESTS_PER_MINUTE, 60_000)) {
      return partnerError("rate_limited", "Too many requests. Wait a minute and try again.");
    }
    try {
      const result = await handler(principal, await context.params);
      return Response.json(result, { status: okStatus });
    } catch (error) {
      if (error instanceof PartnerError) return partnerError(error.code, error.message);
      if (error instanceof InsufficientCreditsError) {
        return partnerError("insufficient_credits", "Not enough video credits for this.", { required: error.required, balance: error.balance });
      }
      console.error("Partner request failed", { partner: principal.partnerId, error });
      return partnerError("error", "Something went wrong. Try again.");
    }
  };
