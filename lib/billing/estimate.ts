import { lyricsCreditBreakdown } from "@/lib/music/song-plan";
import { filmedSecondsForCuts } from "@/lib/video/shot-plan";
import { clipResolution, generationModelById, generationModelBySlug, priceForResolution } from "@/lib/video/models";
import { lyricsClipDurations, singerModelsFor } from "@/lib/video/singer-models";
import { isVideoTier, resolveModeTier } from "@/lib/video/modes";
import { filmedSeconds, isStitchedMode } from "@/lib/video/segments";
import { jobCreditsFromUsd, usdToCredits } from "./math";
import { MOTION_GRAPHICS_CREDITS } from "./plans";

const SONG_USD_PER_SECOND = 0.02;
const VOICE_CHANGE_USD_PER_SECOND = 0.01;

export interface VideoCreditEstimateInput {
  demo?: boolean;
  mode?: string;
  tier?: string;
  modelId?: string;
  modelSlug?: string;
  resolution?: string;
  length: number;
  /** Reference pictures. A lyrics video with one uses lip-sync shots. */
  referenceCount?: number;
  /** The song was already made and paid for on the create page. */
  songReady?: boolean;
  /** On-screen cuts. Each one is filmed at least as long as the model allows. */
  cuts?: readonly { seconds: number; camera?: string }[];
}

/** Credits for one song take: music by the second, plus a small charge when a character re-sings it. */
export const songCredits = (seconds: number, voiced: boolean) =>
  jobCreditsFromUsd(Math.max(0, seconds) * SONG_USD_PER_SECOND + (voiced ? Math.max(0, seconds) * VOICE_CHANGE_USD_PER_SECOND : 0));

export const videoJobCredits = (input: VideoCreditEstimateInput) => {
  if (input.demo || input.mode === "editor-export") return 0;
  if (input.mode === "motion-graphics") {
    const tier = input.tier ?? "pro";
    return MOTION_GRAPHICS_CREDITS[isVideoTier(tier) ? tier : "pro"];
  }
  const resolved = !input.modelId && !input.modelSlug && input.mode && input.tier
    ? resolveModeTier(input.mode, input.tier)
    : null;
  const model = input.modelId
    ? generationModelById(input.modelId)
    : generationModelBySlug(input.modelSlug ?? resolved?.model?.slug ?? "");
  if (!model) return jobCreditsFromUsd(0);
  const requestedResolution = input.resolution || resolved?.resolution;
  const resolution =
    requestedResolution && typeof priceForResolution(model, requestedResolution) === "number"
      ? requestedResolution
      : clipResolution(model.resolutions);
  const usd = priceForResolution(model, resolution);
  if (typeof usd !== "number") return jobCreditsFromUsd(0);
  if (input.mode === "lyrics") {
    const hasSinger = (input.referenceCount ?? 0) > 0;
    const singer = hasSinger ? (singerModelsFor(model.slug)[0] ?? null) : null;
    const credits = lyricsCreditBreakdown(
      input.length,
      lyricsClipDurations(model, hasSinger),
      Boolean(singer),
      input.cuts,
    );
    const singerResolution = singer
      ? singer.resolutions.includes(resolution)
        ? resolution
        : clipResolution(singer.resolutions)
      : resolution;
    const singerUsd = singer ? priceForResolution(singer, singerResolution) : 0;
    const picture =
      credits.brollSeconds * usd + (typeof singerUsd === "number" ? credits.singerSeconds * singerUsd : 0);
    return jobCreditsFromUsd(picture + (input.songReady ? 0 : credits.songSeconds * SONG_USD_PER_SECOND));
  }
  if (input.mode === "prompt" && input.cuts && input.cuts.length > 0) {
    return jobCreditsFromUsd(usd * filmedSecondsForCuts(input.length, model.durations, input.cuts));
  }
  const seconds = isStitchedMode(input.mode)
    ? filmedSeconds(input.length, model.durations)
    : Math.max(0, input.length);
  return jobCreditsFromUsd(usd * seconds);
};

export const productionCredits = (usd: number, demo = false) => (demo ? 0 : jobCreditsFromUsd(usd));

export const spentCredits = (usd: number) => usdToCredits(usd, 0);
