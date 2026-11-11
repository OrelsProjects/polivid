import { lyricsCreditBreakdown } from "@/lib/music/song-plan";
import { EDIT_CREDITS } from "@/lib/video/edit-ops";
import { filmedSecondsForCuts } from "@/lib/video/shot-plan";
import {
  clipDuration,
  clipResolution,
  generationModelById,
  generationModelBySlug,
  priceForResolution,
} from "@/lib/video/models";
import { lyricsClipDurations, singerModelsFor } from "@/lib/video/singer-models";
import { isDirectMode, isVideoTier, resolveModeTier } from "@/lib/video/modes";
import { filmedSeconds, isStitchedMode } from "@/lib/video/segments";
import { jobCreditsFromUsd, usdToCredits } from "./math";
import {
  LOOP_BASE_CREDITS,
  LOOP_CREDITS_PER_HALF_MINUTE,
  LOOP_MODEL,
  MAX_STILLS,
  SPEECH_USD_PER_SECOND,
  STILL_IMAGE_USD,
  STILLS_MODEL,
  STILLS_RENDER_CREDITS,
  stillCountFor,
  stillsUseDraft,
} from "@/lib/video/stills";
import { CAPTIONS_CREDITS, MOTION_GRAPHICS_CREDITS } from "./plans";

const SONG_USD_PER_SECOND = 0.02;
const VOICE_CHANGE_USD_PER_SECOND = 0.01;

export interface VideoCreditEstimateInput {
  demo?: boolean;
  mode?: string;
  /** `stills` prices drawn pictures and a voice; `loop` prices a voice over a background clip. */
  media?: string;
  tier?: string;
  modelId?: string;
  modelSlug?: string;
  resolution?: string;
  length: number;
  /** Pictures an animated-stills video draws, when its script sets the count. Unset counts them from the length. */
  pictures?: number;
  /** Reference pictures. A lyrics video with one uses lip-sync shots. */
  referenceCount?: number;
  /** The song was already made and paid for on the create page. */
  songReady?: boolean;
  /** On-screen cuts. Each one is filmed at least as long as the model allows. */
  cuts?: readonly { seconds: number; camera?: string }[];
  /** Clips the person chose. Unset means the fewest the model needs. */
  clips?: number;
}

/** Credits for one song take: music by the second, plus a small charge when a character re-sings it. */
export const songCredits = (seconds: number, voiced: boolean) =>
  jobCreditsFromUsd(Math.max(0, seconds) * SONG_USD_PER_SECOND + (voiced ? Math.max(0, seconds) * VOICE_CHANGE_USD_PER_SECOND : 0));

/** Animated stills: each picture, the voice by the second, and one charge for the render. */
export const stillsCredits = (lengthSec: number, draft: boolean, pictureCount?: number) => {
  const seconds = Math.max(0, lengthSec);
  const count =
    pictureCount && Number.isInteger(pictureCount) && pictureCount > 0
      ? Math.min(MAX_STILLS, pictureCount)
      : stillCountFor(seconds);
  const pictures = count * (draft ? STILL_IMAGE_USD.draft : STILL_IMAGE_USD.final);
  return usdToCredits(pictures + seconds * SPEECH_USD_PER_SECOND) + STILLS_RENDER_CREDITS;
};

/** Narration over a background clip: a base charge, a little per half minute of render, and the voice. */
export const loopCredits = (lengthSec: number) => {
  const seconds = Math.max(0, lengthSec);
  return (
    LOOP_BASE_CREDITS +
    LOOP_CREDITS_PER_HALF_MINUTE * Math.max(1, Math.ceil(seconds / 30)) +
    usdToCredits(seconds * SPEECH_USD_PER_SECOND)
  );
};

export const videoJobCredits = (input: VideoCreditEstimateInput) => {
  if (input.demo || input.mode === "editor-export") return 0;
  if (input.mode === "motion-graphics") {
    const tier = input.tier ?? "pro";
    return MOTION_GRAPHICS_CREDITS[isVideoTier(tier) ? tier : "pro"];
  }
  if (input.mode === "captions") return CAPTIONS_CREDITS;
  if (input.mode === "edit") return EDIT_CREDITS;
  if (input.media === "stills" || input.modelSlug === STILLS_MODEL) {
    return stillsCredits(input.length, stillsUseDraft(input.tier), input.pictures);
  }
  if (input.media === "loop" || input.modelSlug === LOOP_MODEL) return loopCredits(input.length);
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
    ? filmedSeconds(input.length, model.durations, input.clips)
    : isDirectMode(input.mode)
      ? // One clip, at a length the model can film.
        clipDuration(Math.max(0, input.length), model.durations)
      : Math.max(0, input.length);
  return jobCreditsFromUsd(usd * seconds);
};

export const productionCredits = (usd: number, demo = false) => (demo ? 0 : jobCreditsFromUsd(usd));

export const spentCredits = (usd: number) => usdToCredits(usd, 0);
