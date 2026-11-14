import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { reserveCredits } from "@/lib/billing/credits";
import { productionCredits, spentCredits } from "@/lib/billing/estimate";
import { db } from "@/lib/db";
import { capabilityById, defaultVideoCapability } from "./capabilities";
import { loadStructure } from "./jobs/coordinator";
import { isProductionVideoModel, readHints, shotUsdPerSecFor } from "./hints";
import type { InputRecord } from "./schema";
import { currentEntityData, discardShotTake, putEntity, reopenFinishingSteps, unblockDependents, updateProduction } from "./store";

const RETRY_FACTOR = Number(process.env.PRODUCTION_RETRY_FACTOR ?? "1.3");

export class RefilmError extends Error {}

/** Credits one new take of a shot will hold: filming, review, and the retry margin. */
export const refilmCredits = async (productionId: string, shotId: string, model?: string) => {
  const structure = await loadStructure(productionId);
  const shot = structure?.shots.find((entry) => entry.id === shotId);
  if (!shot) return null;
  const input = await currentEntityData<InputRecord>(productionId, "input", "input");
  const hints = readHints(input?.hints);
  const withModel = model ? { ...hints, shotModels: { ...(hints.shotModels ?? {}), [shotId]: model } } : hints;
  const perSecond = shotUsdPerSecFor(withModel)(shotId) ?? defaultVideoCapability().pricing.usd;
  const reviewUsd = capabilityById("review-flash")?.pricing.usd ?? 0;
  const usd = (shot.generationDurationSec * perSecond + reviewUsd) * RETRY_FACTOR;
  return productionCredits(usd, !hasOpenRouterKey());
};

/** Statuses where a shot can be filmed again: the take exists and nothing is mid-flight for the whole film. */
const REFILMABLE = new Set(["ready", "failed", "reviewing", "generating"]);

/**
 * Films one shot again, optionally with another model, then re-assembles the film.
 * Credits are held on top of what the production already used; settlement at the end refunds what the new take didn't need.
 */
export const refilmShot = async (userId: string, productionId: string, shotId: string, model?: string) => {
  const production = await db.production.findFirst({ where: { id: productionId, userId } });
  if (!production) throw new RefilmError("Production not found.");
  if (!REFILMABLE.has(production.status)) {
    throw new RefilmError("This production hasn't been filmed yet. Change the plan with the production_* tools, then approve it.");
  }
  if (model && !isProductionVideoModel(model)) {
    throw new RefilmError("That model can't film production shots. Pick one list_models marks as production: true.");
  }
  const review = await db.productionStep.findFirst({
    where: { productionId, kind: "review_shot", targetKey: `shot:${shotId}` },
  });
  if (!review) throw new RefilmError("That shot has no take yet. Use a shot id from get_production.");
  const busy = await db.productionStep.count({
    where: { productionId, targetKey: `shot:${shotId}`, status: { in: ["leased", "waiting_provider"] } },
  });
  if (busy > 0) throw new RefilmError("That shot is filming right now. Wait for it to finish.");

  const credits = (await refilmCredits(productionId, shotId, model)) ?? 0;
  if (credits > 0) {
    await reserveCredits(userId, credits, {
      reason: "production_hold",
      refType: "production",
      refId: productionId,
      idempotencyKey: `production_hold:${productionId}:refilm:${shotId}:${Date.now().toString(36)}`,
    });
    // A settled production has already been charged for what it spent, so the new hold sits on top of that.
    const base = production.creditsHeld > 0 ? production.creditsHeld : spentCredits(Number(production.spentUsd));
    await db.production.update({ where: { id: productionId }, data: { creditsHeld: base + credits } });
  }

  if (model) {
    const input = await currentEntityData<InputRecord>(productionId, "input", "input");
    if (input) {
      const hints = readHints(input.hints);
      await putEntity(
        productionId,
        "input",
        "input",
        { ...input, hints: { ...hints, shotModels: { ...(hints.shotModels ?? {}), [shotId]: model } } },
        "user",
      );
    }
  }

  await discardShotTake(productionId, review);
  await reopenFinishingSteps(productionId);
  await unblockDependents(productionId);
  await updateProduction(productionId, { status: "generating", stage: "shots", error: null });
  return { productionId, shotId, credits, status: "generating" as const };
};
