import "server-only";
import { z } from "zod";
import { getBalance, setPlanCredits } from "@/lib/billing/credits";
import { PartnerError } from "./http";

const AllowanceSchema = z.strictObject({
  /** Video credits the person has for this period. Replaces what is left, it does not add to it. */
  credits: z.number().int().min(0).max(1_000_000),
  /** When this period ends, as an ISO date. */
  periodEnd: z.string().datetime({ offset: true }),
  /**
   * Makes a repeated call a no-op, such as the billing event id that caused it. Defaults to the
   * period and the amount, so the same allowance for the same period is only set once.
   */
  key: z.string().trim().min(1).max(120).optional(),
});

/**
 * Sets the person's video credits from their plan with the partner. The partner calls it when the
 * plan starts, changes, or renews. Each video holds its price from these credits and gives it back
 * if it fails, so the partner never has to count.
 */
export const setPartnerAllowance = async (partnerId: string, userId: string, raw: unknown) => {
  const parsed = AllowanceSchema.safeParse(raw);
  if (!parsed.success) throw new PartnerError("invalid", "Send credits (a whole number) and periodEnd (an ISO date).");
  const { credits, periodEnd, key } = parsed.data;
  await setPlanCredits(
    userId,
    credits,
    {
      reason: "partner_allowance",
      refType: "partner",
      refId: partnerId,
      idempotencyKey: `partner_allowance:${userId}:${key ?? `${periodEnd}:${credits}`}`,
    },
    { creditsRefillAt: new Date(periodEnd) },
  );
  return partnerBalance(userId);
};

/** What the person has left. Partner users only ever have the allowance the partner set. */
export const partnerBalance = async (userId: string) => {
  const balance = await getBalance(userId);
  return { credits: balance.total, periodEnd: balance.creditsRefillAt?.toISOString() ?? null };
};
