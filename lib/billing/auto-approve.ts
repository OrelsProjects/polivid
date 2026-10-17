/** The Coach asks before a credit spend at or above this. Cheaper spends run on their own. */
export const AUTO_APPROVE_UNDER_CREDITS = 200;

/** True when a priced action should wait for the person. An unknown price does not reach this. */
export const spendNeedsApproval = (credits: number) =>
  !Number.isFinite(credits) || credits >= AUTO_APPROVE_UNDER_CREDITS;
