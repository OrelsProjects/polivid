import "server-only";
import { randomUUID } from "node:crypto";
import { refundCredits, requireCredits, reserveCredits } from "@/lib/billing/credits";

export const spendCharacterCredit = async (
  userId: string,
  reason: "character_image" | "character_voice" | "image",
) => {
  await requireCredits(userId, 1);
  const refId = randomUUID();
  await reserveCredits(userId, 1, {
    reason,
    refType: reason,
    refId,
    idempotencyKey: `${reason}:${refId}`,
  });
  return {
    refund: () =>
      refundCredits(userId, 1, {
        reason: `${reason}_refund`,
        refType: reason,
        refId,
        idempotencyKey: `${reason}_refund:${refId}`,
        holdKey: `${reason}:${refId}`,
      }),
  };
};
