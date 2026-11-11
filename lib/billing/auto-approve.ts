/** The Coach asks before a credit spend at or above this. Cheaper spends run on their own. */
export const AUTO_APPROVE_UNDER_CREDITS = 200;

/** A storyboard asks only when its frames would cost this many credits or more. */
export const STORYBOARD_AUTO_APPROVE_UNDER = 30;

/** True when a priced action should wait for the person. An unknown price does not reach this. */
export const spendNeedsApproval = (credits: number, threshold = AUTO_APPROVE_UNDER_CREDITS) =>
  !Number.isFinite(credits) || credits >= threshold;
