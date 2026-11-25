/**
 * Errors a partner route returns on purpose. The code is what the partner's own app should branch on;
 * the message is plain, carries no product name, and is safe to show its users.
 */
export class PartnerError extends Error {
  constructor(
    readonly code: "invalid" | "not_found" | "conflict" | "not_ready",
    message: string,
  ) {
    super(message);
    this.name = "PartnerError";
  }
}
