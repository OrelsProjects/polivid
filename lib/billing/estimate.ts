import { clipResolution, generationModelById, generationModelBySlug, priceForResolution } from "@/lib/video/models";
import { isVideoTier } from "@/lib/video/modes";
import { jobCreditsFromUsd, usdToCredits } from "./math";
import { MOTION_GRAPHICS_CREDITS } from "./plans";

export interface VideoCreditEstimateInput {
  demo?: boolean;
  mode?: string;
  tier?: string;
  modelId?: string;
  modelSlug?: string;
  resolution?: string;
  length: number;
}

export const videoJobCredits = (input: VideoCreditEstimateInput) => {
  if (input.demo || input.mode === "editor-export") return 0;
  if (input.mode === "motion-graphics") {
    const tier = input.tier ?? "pro";
    return MOTION_GRAPHICS_CREDITS[isVideoTier(tier) ? tier : "pro"];
  }
  const model = input.modelId
    ? generationModelById(input.modelId)
    : generationModelBySlug(input.modelSlug ?? "");
  if (!model) return jobCreditsFromUsd(0);
  const resolution =
    input.resolution && typeof priceForResolution(model, input.resolution) === "number"
      ? input.resolution
      : clipResolution(model.resolutions);
  const usd = priceForResolution(model, resolution);
  if (typeof usd !== "number") return jobCreditsFromUsd(0);
  return jobCreditsFromUsd(usd * Math.max(0, input.length));
};

export const productionCredits = (usd: number, demo = false) => (demo ? 0 : jobCreditsFromUsd(usd));

export const spentCredits = (usd: number) => usdToCredits(usd, 0);
