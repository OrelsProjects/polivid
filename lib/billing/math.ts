import { CREDITS_PER_USD, MIN_JOB_CREDITS } from "./plans";

export const usdToCredits = (usd: number, minimum = 0) =>
  Math.max(minimum, Math.ceil(Math.max(0, usd) * CREDITS_PER_USD));

export const jobCreditsFromUsd = (usd: number) => usdToCredits(usd, MIN_JOB_CREDITS);

export const splitSpend = (planCredits: number, bonusCredits: number, amount: number) => {
  if (amount <= 0) return { fromPlan: 0, fromBonus: 0 };
  if (planCredits + bonusCredits < amount) return null;
  const fromPlan = Math.min(planCredits, amount);
  return { fromPlan, fromBonus: amount - fromPlan };
};

export const splitRefund = (fromPlanHeld: number, fromBonusHeld: number, unused: number) => {
  const amount = Math.max(0, unused);
  const fromBonus = Math.min(fromBonusHeld, amount);
  const fromPlan = Math.min(fromPlanHeld, amount - fromBonus);
  return { fromPlan, fromBonus };
};

export const addMonthsUtc = (from: Date, months: number) => {
  const next = new Date(from.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

export const nextRefillAt = (from: Date, now = new Date()) => {
  let next = from;
  if (next.getTime() > now.getTime()) return next;
  while (next.getTime() <= now.getTime()) {
    next = addMonthsUtc(next, 1);
  }
  return next;
};

export const isPaidSubscriptionStatus = (status: string | null | undefined) =>
  status === "active" || status === "trialing";
