import { jobCreditsFromUsd } from "@/lib/billing/math";
import { nameAsPicture } from "@/lib/characters/slash";

/**
 * Character swap puts a saved character into a video the person uploads, two ways:
 * - `replace` edits the video itself with Kling 3.0 Omni. The scene, the other people,
 *   and the sound stay. Only what the prompt names is replaced with the character.
 * - `moves` uses Kling 3.0 Motion Control. The character performs the video's moves
 *   in a new clip built around the character's picture. The scene is not kept.
 * Nothing is planned or rewritten, so this file holds the whole price and every limit.
 */

export const SWAP_METHODS = ["replace", "moves"] as const;
export type SwapMethod = (typeof SWAP_METHODS)[number];
export const DEFAULT_SWAP_METHOD: SwapMethod = "replace";

export const isSwapMethod = (value: unknown): value is SwapMethod =>
  typeof value === "string" && (SWAP_METHODS as readonly string[]).includes(value);

export const SWAP_METHOD_LABELS: Record<SwapMethod, { title: string; detail: string }> = {
  replace: {
    title: "Replace in video",
    detail: "Keeps your video and swaps in your character. Longer than 15 seconds is done in parts and joined.",
  },
  moves: {
    title: "Copy the moves",
    detail: "A new clip of your character doing the video's moves. Longer than 30 seconds is done in parts and joined.",
  },
};

/** Stored as the job's model, the way a quick edit stores `edit`. The model says which method the job runs. */
export const SWAP_MODEL = "kling-3.0-motion-control";
export const SWAP_LABEL = "Kling 3.0 Motion Control";
export const SWAP_EDIT_MODEL = "kling-3.0-omni-edit";
export const SWAP_EDIT_LABEL = "Kling 3.0 Omni video edit";

export const swapModelFor = (method: SwapMethod) => (method === "replace" ? SWAP_EDIT_MODEL : SWAP_MODEL);
export const swapMethodForModel = (model: string): SwapMethod => (model === SWAP_EDIT_MODEL ? "replace" : "moves");

/**
 * Copy the moves only. `video` follows the performance video's framing and runs up to 30 seconds.
 * `image` keeps the picture's framing and facing, up to 10 seconds.
 */
export const SWAP_ORIENTATIONS = ["video", "image"] as const;
export type SwapOrientation = (typeof SWAP_ORIENTATIONS)[number];
export const DEFAULT_SWAP_ORIENTATION: SwapOrientation = "video";

export const isSwapOrientation = (value: unknown): value is SwapOrientation =>
  typeof value === "string" && (SWAP_ORIENTATIONS as readonly string[]).includes(value);

/** Kling needs at least this much video either way. */
export const MIN_SWAP_SECONDS = 3;
export const MAX_SWAP_SECONDS: Record<SwapOrientation, number> = { video: 30, image: 10 };
/** Kling 3.0 Omni edits videos up to this long in one go. */
export const MAX_SWAP_EDIT_SECONDS = 15;
/** A longer video is swapped in parts and joined back, up to this long in all. */
export const MAX_SWAP_TOTAL_SECONDS = 120;
/** A split point moves to a scene cut this close to it, so the join hides inside a cut. */
const SCENE_SNAP_SECONDS = 2.5;

/** The longest part one Kling task takes for this kind of swap. */
export const swapPartLimit = (method: SwapMethod, orientation: SwapOrientation = DEFAULT_SWAP_ORIENTATION) =>
  method === "replace" ? MAX_SWAP_EDIT_SECONDS : MAX_SWAP_SECONDS[orientation];

/** How many parts a video of this length is swapped in. */
export const swapPartCount = (sourceSeconds: number, method: SwapMethod, orientation?: SwapOrientation) =>
  Math.max(1, Math.ceil(sourceSeconds / swapPartLimit(method, orientation) - 1e-9));

export interface SwapPart {
  /** Where the part starts in the video, in seconds. */
  start: number;
  seconds: number;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Splits a video too long for one task into even parts, each between 3 seconds and `limit`.
 * A split point moves to the nearest scene cut within 2.5 seconds, so the join falls on a cut
 * the video already has. A video that fits is one part.
 */
export const swapParts = (sourceSeconds: number, limit: number, sceneCuts: readonly number[] = []): SwapPart[] => {
  const count = Math.max(1, Math.ceil(sourceSeconds / limit - 1e-9));
  if (count === 1) return [{ start: 0, seconds: round3(sourceSeconds) }];
  const bounds = [0];
  for (let index = 1; index < count; index += 1) {
    const previous = bounds[index - 1]!;
    const left = count - index;
    // The part before this point, and every part after it, must stay within 3 seconds and the limit.
    const low = Math.max(previous + MIN_SWAP_SECONDS, sourceSeconds - left * limit);
    const high = Math.min(previous + limit, sourceSeconds - left * MIN_SWAP_SECONDS);
    const ideal = previous + (sourceSeconds - previous) / (left + 1);
    const cut = sceneCuts
      .filter((time) => time >= low && time <= high && Math.abs(time - ideal) <= SCENE_SNAP_SECONDS)
      .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0];
    bounds.push(round3(cut ?? Math.min(high, Math.max(low, ideal))));
  }
  bounds.push(sourceSeconds);
  return bounds.slice(0, -1).map((start, index) => ({ start, seconds: round3(bounds[index + 1]! - start) }));
};

/** Shown when the video is swapped in parts, or null. */
export const swapSplitNote = (sourceSeconds: number, method: SwapMethod, orientation?: SwapOrientation) => {
  const count = swapPartCount(sourceSeconds, method, orientation);
  if (count < 2 || sourceSeconds > MAX_SWAP_TOTAL_SECONDS) return null;
  const limit = swapPartLimit(method, orientation);
  return `Your video is ${Math.round(sourceSeconds * 10) / 10} seconds. The model takes up to ${limit} at a time, so it's swapped in ${count} parts and joined back into one video.`;
};

/** Kling reads this much of the prompt. */
export const SWAP_PROMPT_LIMIT = 2500;

/** Kling 3.0 Motion Control and Omni with a video both cost this, on the Advanced package. */
export const SWAP_USD_PER_SECOND: Record<string, number> = { "720p": 0.126, "1080p": 0.168 };

/** Ultra makes 1080p. Low and pro make 720p. */
export const swapResolutionFor = (tier?: string) => (tier === "ultra" ? "1080p" : "720p");

/** Whole seconds billed for a video of this length. */
export const swapSeconds = (sourceSeconds: number) => Math.ceil(Math.max(0, sourceSeconds));

export const swapCredits = (sourceSeconds: number, resolution?: string) =>
  jobCreditsFromUsd(swapSeconds(sourceSeconds) * (SWAP_USD_PER_SECOND[resolution ?? ""] ?? SWAP_USD_PER_SECOND["720p"]));

/** Why this video can't be used, or null when it can. A long one is swapped in parts, so only the total is capped. */
export const swapLengthProblem = (sourceSeconds: number) => {
  if (!(sourceSeconds >= MIN_SWAP_SECONDS)) {
    return `The video needs to be at least ${MIN_SWAP_SECONDS} seconds.`;
  }
  if (sourceSeconds > MAX_SWAP_TOTAL_SECONDS + 0.5) {
    return `Use a video up to ${MAX_SWAP_TOTAL_SECONDS / 60} minutes long. Trim it and try again.`;
  }
  return null;
};

/** The length Kling is asked to make when it edits a video: the video's own, within 3 to 15. */
export const swapEditDuration = (sourceSeconds: number) => Math.min(15, Math.max(3, Math.round(sourceSeconds)));

/** Kling edits videos whose sides run 700 to 4553 pixels, at 24 to 60 frames a second, 0.4 to 2 wide per tall. */
const EDIT_MIN_SIDE = 700;
const EDIT_TARGET_SIDE = 720;
const EDIT_MAX_SIDE = 4553;
const EDIT_MAX_PIXELS = 8_294_400;

/** Why Kling can't edit a video of this shape, or null. Too small or too slow is fixed for them instead. */
export const swapEditShapeProblem = (width: number | null, height: number | null) => {
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio < 0.4 || ratio > 2) return "Replacing in a video works on videos between 2:5 tall and 2:1 wide.";
  return null;
};

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

/**
 * The size and frame rate to convert a video to before Kling edits it, or null when it is fine as it is.
 * Small phone clips are scaled up so the short side is 720. Odd frame rates are moved into range.
 */
export const swapEditConversion = (probe: { width: number | null; height: number | null; fps: number | null }) => {
  const { width, height, fps } = probe;
  if (!width || !height) return null;
  let nextWidth = width;
  let nextHeight = height;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  if (shortSide < EDIT_MIN_SIDE) {
    const scale = EDIT_TARGET_SIDE / shortSide;
    nextWidth = even(width * scale);
    nextHeight = even(height * scale);
  } else if (longSide > EDIT_MAX_SIDE || width * height > EDIT_MAX_PIXELS) {
    const scale = Math.min(EDIT_MAX_SIDE / longSide, Math.sqrt(EDIT_MAX_PIXELS / (width * height)));
    nextWidth = even(width * scale - 2);
    nextHeight = even(height * scale - 2);
  }
  const nextFps = fps && fps < 24 ? 24 : fps && fps > 60 ? 60 : null;
  if (nextWidth === width && nextHeight === height && nextFps === null) return null;
  return { width: nextWidth, height: nextHeight, fps: nextFps };
};

/** Kling takes reference pictures with sides of 300 pixels or more, between 1:2.5 and 2.5:1. */
const PICTURE_MIN_RATIO = 0.4;
const PICTURE_MAX_RATIO = 2.5;
/** Under this the face comes out soft, so the picture is scaled up to PICTURE_TARGET_SIDE. */
const PICTURE_SMALL_SIDE = 512;
const PICTURE_TARGET_SIDE = 1024;
const PICTURE_MAX_SIDE = 4096;

/**
 * How to fit a character picture to what Kling accepts, or null when it already fits.
 * A small picture is scaled up so its short side is 1024. One too tall or too wide gets plain
 * margins up to the nearest shape Kling takes, so nothing of the person is cropped.
 * `width` and `height` are the scaled size; `canvasWidth` and `canvasHeight` include the margins.
 * Sizes are even, because a 4:2:0 JPEG can't have odd sides.
 */
export const swapPictureConversion = (width: number | null, height: number | null) => {
  if (!width || !height) return null;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const tooSmall = shortSide < PICTURE_SMALL_SIDE;
  const tooBig = longSide > PICTURE_MAX_SIDE;
  const badShape = width / height < PICTURE_MIN_RATIO || width / height > PICTURE_MAX_RATIO;
  if (!tooSmall && !tooBig && !badShape) return null;
  const scale = Math.min(tooSmall ? PICTURE_TARGET_SIDE / shortSide : 1, PICTURE_MAX_SIDE / longSide);
  const scaledWidth = even(width * scale);
  const scaledHeight = even(height * scale);
  const ratio = scaledWidth / scaledHeight;
  // One pixel past the limit before rounding to even, so the shape lands inside it.
  const canvasWidth = ratio < PICTURE_MIN_RATIO ? even(Math.ceil(scaledHeight * PICTURE_MIN_RATIO) + 1) : scaledWidth;
  const canvasHeight = ratio > PICTURE_MAX_RATIO ? even(Math.ceil(scaledWidth / PICTURE_MAX_RATIO) + 1) : scaledHeight;
  return { width: scaledWidth, height: scaledHeight, canvasWidth, canvasHeight };
};

/** Stored when the person wrote nothing. It is a title only. */
export const SWAP_DEFAULT_PROMPT = "Character swap";

const KEEP_THE_REST =
  "Keep everything else in the video unchanged: the scene, the other people and animals, the camera, the motion, and the timing.";

/**
 * The instruction Kling gets when it edits a video. The character's name becomes @image_1, the
 * character's picture. With no instruction, the main person is the one replaced.
 */
export const swapEditPrompt = (prompt: string, characterName: string | null) => {
  const written = prompt.trim() && prompt.trim() !== SWAP_DEFAULT_PROMPT ? prompt.trim() : "";
  let text = written
    ? characterName
      ? nameAsPicture(written, characterName, "@image_1")
      : written
    : "Replace the main person in the video with the person in @image_1.";
  if (!text.includes("@image_1")) text = `${text.replace(/[.\s]*$/, ".")} The new character is the person in @image_1.`;
  return `${text.replace(/[.\s]*$/, ".")} ${KEEP_THE_REST}`.slice(0, SWAP_PROMPT_LIMIT);
};

/** Motion Control only sees the picture, so the character's name becomes words it understands. */
export const swapMovesPrompt = (prompt: string, characterName: string | null) => {
  const written = prompt.trim() && prompt.trim() !== SWAP_DEFAULT_PROMPT ? prompt.trim() : "";
  if (!written) return "";
  return (characterName ? nameAsPicture(written, characterName) : written).slice(0, SWAP_PROMPT_LIMIT);
};
