import { jobCreditsFromUsd } from "@/lib/billing/math";

/**
 * Character swap: Kling 3.0 Motion Control puts a character picture into an uploaded
 * performance video. The character copies the moves and the video keeps its sound.
 * Nothing is planned or rewritten, so this file holds the whole price and every limit.
 */

/** Stored as the job's model, the way a quick edit stores `edit`. */
export const SWAP_MODEL = "kling-3.0-motion-control";
export const SWAP_LABEL = "Kling 3.0 Motion Control";

/**
 * `video` follows the performance video's framing and runs up to 30 seconds.
 * `image` keeps the picture's framing and facing, up to 10 seconds.
 */
export const SWAP_ORIENTATIONS = ["video", "image"] as const;
export type SwapOrientation = (typeof SWAP_ORIENTATIONS)[number];
export const DEFAULT_SWAP_ORIENTATION: SwapOrientation = "video";

export const isSwapOrientation = (value: unknown): value is SwapOrientation =>
  typeof value === "string" && (SWAP_ORIENTATIONS as readonly string[]).includes(value);

/** Kling needs at least this much continuous motion. */
export const MIN_SWAP_SECONDS = 3;
export const MAX_SWAP_SECONDS: Record<SwapOrientation, number> = { video: 30, image: 10 };

/** Kling reads this much of the optional prompt. */
export const SWAP_PROMPT_LIMIT = 2500;

/** Same rate as Kling 3.0 filming. Billed per second of the performance video. */
export const SWAP_USD_PER_SECOND: Record<string, number> = { "720p": 0.126, "1080p": 0.168 };

/** Ultra films 1080p. Low and pro film 720p. */
export const swapResolutionFor = (tier?: string) => (tier === "ultra" ? "1080p" : "720p");

/** Whole seconds billed for a performance video of this length. */
export const swapSeconds = (sourceSeconds: number) => Math.ceil(Math.max(0, sourceSeconds));

export const swapCredits = (sourceSeconds: number, resolution?: string) =>
  jobCreditsFromUsd(swapSeconds(sourceSeconds) * (SWAP_USD_PER_SECOND[resolution ?? ""] ?? SWAP_USD_PER_SECOND["720p"]));

/** Why this performance video can't be used, or null when it can. */
export const swapLengthProblem = (sourceSeconds: number, orientation: SwapOrientation) => {
  if (!(sourceSeconds >= MIN_SWAP_SECONDS)) {
    return `The video needs at least ${MIN_SWAP_SECONDS} seconds of motion.`;
  }
  const max = MAX_SWAP_SECONDS[orientation];
  if (sourceSeconds > max + 0.5) {
    return orientation === "image"
      ? `Keeping the picture's framing works on videos up to ${max} seconds. Trim it, or follow the video's framing for up to ${MAX_SWAP_SECONDS.video}.`
      : `Trim the video to ${max} seconds or less.`;
  }
  return null;
};
