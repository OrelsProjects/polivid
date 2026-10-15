import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { db } from "@/lib/db";
import { estimatePlanCost } from "@/lib/production/cost";
import { currentEntityData } from "@/lib/production/store";
import { approveGeneration, loadStructure } from "@/lib/production/jobs/coordinator";
import type { DevelopOutput } from "@/lib/production/schema";
import { refundCredits, reserveCredits } from "./credits";
import { productionCredits, spentCredits } from "./estimate";
import { InsufficientCreditsError } from "./errors";

export const estimateProductionCredits = async (productionId: string) => {
  const production = await db.production.findUnique({ where: { id: productionId } });
  if (!production) return 0;
  const develop = await currentEntityData<DevelopOutput>(productionId, "script", "script");
  const structure = await loadStructure(productionId);
  if (!develop || !structure) return 0;
  const cost = estimatePlanCost({ develop, structure });
  return productionCredits(cost.total, !hasOpenRouterKey());
};

export const approveGenerationCharged = async (productionId: string, userId: string) => {
  const credits = await estimateProductionCredits(productionId);
  if (credits > 0) {
    await reserveCredits(userId, credits, {
      reason: "production_hold",
      refType: "production",
      refId: productionId,
      idempotencyKey: `production_hold:${productionId}`,
    });
    await db.production.update({ where: { id: productionId }, data: { creditsHeld: credits } });
  }
  try {
    return await approveGeneration(productionId);
  } catch (error) {
    if (credits > 0) {
      await refundCredits(userId, credits, {
        reason: "production_refund",
        refType: "production",
        refId: productionId,
        idempotencyKey: `production_refund:${productionId}:abort`,
        holdKey: `production_hold:${productionId}`,
      });
      await db.production.update({ where: { id: productionId }, data: { creditsHeld: 0 } });
    }
    throw error;
  }
};

export const settleProductionCredits = async (productionId: string) => {
  const production = await db.production.findUnique({ where: { id: productionId } });
  if (!production || production.creditsHeld <= 0) return;
  const unused = Math.max(0, production.creditsHeld - spentCredits(Number(production.spentUsd)));
  if (unused > 0) {
    await refundCredits(production.userId, unused, {
      reason: "production_refund",
      refType: "production",
      refId: productionId,
      idempotencyKey: `production_refund:${productionId}`,
      holdKey: `production_hold:${productionId}`,
    });
  }
  await db.production.update({ where: { id: productionId }, data: { creditsHeld: 0 } });
};

export { InsufficientCreditsError };
