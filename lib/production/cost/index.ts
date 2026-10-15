import { capabilityById, defaultImageCapability, defaultVideoCapability } from "../capabilities";
import type { ProductionPlan, StructureOutput } from "../schema";

const RETRY_FACTOR = Number(process.env.PRODUCTION_RETRY_FACTOR ?? "1.3");

export interface CostBreakdown {
  planner: number;
  images: number;
  video: number;
  speech: number;
  lipsync: number;
  music: number;
  sfx: number;
  review: number;
  transcribe: number;
  retries: number;
  total: number;
}

const roundUsd = (value: number) => Math.round(value * 10000) / 10000;

export const estimatePlanCost = (
  plan: Pick<ProductionPlan, "develop"> & { structure: StructureOutput | null },
  extras: { plannerUsd?: number; imageCount?: number } = {},
): CostBreakdown => {
  const structure = plan.structure;
  const video = defaultVideoCapability();
  const image = defaultImageCapability(true);
  const speech = capabilityById("speech-eleven-v4")!;
  const lipsync = capabilityById("lipsync-sync-3")!;
  const music = capabilityById("music-v2-5")!;
  const sfx = capabilityById("sfx-eleven")!;
  const review = capabilityById("review-flash")!;
  const transcribe = capabilityById("scribe-v2")!;

  const imageCount = extras.imageCount ?? (structure ? structure.characters.length + structure.locations.length + structure.shots.length : 3);
  const images = imageCount * image.pricing.usd;

  let videoUsd = 0;
  let speechUsd = 0;
  let lipsyncUsd = 0;
  let musicUsd = 0;
  let sfxUsd = 0;
  let reviewUsd = 0;
  let transcribeUsd = 0;

  if (structure) {
    for (const shot of structure.shots) {
      videoUsd += shot.generationDurationSec * video.pricing.usd;
      reviewUsd += review.pricing.usd;
    }
    for (const segment of structure.audioSegments) {
      const chars = segment.text?.length ?? 0;
      if (segment.track === "dialogue" || segment.track === "narration") {
        speechUsd += chars * speech.pricing.usd;
        transcribeUsd += (segment.measuredDurationSec ?? segment.durationSec) * transcribe.pricing.usd;
      }
      if (segment.track === "music") musicUsd += segment.durationSec * music.pricing.usd;
      if (segment.track === "sfx" || segment.track === "ambience") sfxUsd += segment.durationSec * sfx.pricing.usd;
    }
    for (const shot of structure.shots) {
      if (shot.speechMode === "lipsync") lipsyncUsd += shot.generationDurationSec * lipsync.pricing.usd;
    }
  }

  const planner = extras.plannerUsd ?? 0.12;
  const subtotal = planner + images + videoUsd + speechUsd + lipsyncUsd + musicUsd + sfxUsd + reviewUsd + transcribeUsd;
  const retries = subtotal * (RETRY_FACTOR - 1);
  const total = roundUsd(subtotal + retries);

  return {
    planner: roundUsd(planner),
    images: roundUsd(images),
    video: roundUsd(videoUsd),
    speech: roundUsd(speechUsd),
    lipsync: roundUsd(lipsyncUsd),
    music: roundUsd(musicUsd),
    sfx: roundUsd(sfxUsd),
    review: roundUsd(reviewUsd),
    transcribe: roundUsd(transcribeUsd),
    retries: roundUsd(retries),
    total,
  };
};

export const budgetGate = (estimated: number, budget: number, spent: number) => {
  const remaining = budget - spent;
  if (estimated > remaining) {
    return {
      ok: false as const,
      message: `This step needs about $${estimated.toFixed(2)} but $${Math.max(0, remaining).toFixed(2)} remains in the budget.`,
    };
  }
  return { ok: true as const, message: null };
};

export const estimateChangedMaterially = (previous: number, next: number, threshold = 0.25) => {
  if (previous <= 0) return next > 0.5;
  return Math.abs(next - previous) / previous >= threshold;
};
