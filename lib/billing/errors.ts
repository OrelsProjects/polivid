export class InsufficientCreditsError extends Error {
  constructor(
    readonly required: number,
    readonly balance: number,
  ) {
    super(
      required > 0
        ? `This needs ${required} credits. You have ${balance}.`
        : "You need credits to continue.",
    );
    this.name = "InsufficientCreditsError";
  }
}

export const insufficientCreditsResponse = (error: InsufficientCreditsError) =>
  Response.json(
    {
      code: "insufficient_credits",
      error: error.message,
      required: error.required,
      balance: error.balance,
    },
    { status: 402 },
  );
