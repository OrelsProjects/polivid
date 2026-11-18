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
    detail: "Keeps your video and swaps in your character. Up to 15 seconds.",
  },
  moves: {
    title: "Copy the moves",
    detail: "A new clip of your character doing the video's moves. Up to 30 seconds.",
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
/** Kling 3.0 Omni edits videos up to this long. */
export const MAX_SWAP_EDIT_SECONDS = 15.5;
/** Replacing in a longer video uses its first this-many seconds. */
export const SWAP_EDIT_USED_SECONDS = 15;

/** The seconds of the video a swap actually uses, and bills: replacing uses the first 15 of a longer one. */
export const swapUsedSeconds = (sourceSeconds: number, method: SwapMethod) =>
  method === "replace" && sourceSeconds > MAX_SWAP_EDIT_SECONDS ? SWAP_EDIT_USED_SECONDS : sourceSeconds;

/** Shown when only the start of the video will be used, or null. */
export const swapTrimNote = (sourceSeconds: number, method: SwapMethod) => {
  if (method !== "replace" || !(sourceSeconds > MAX_SWAP_EDIT_SECONDS)) return null;
  return `Your video is ${Math.round(sourceSeconds * 10) / 10} seconds. Replacing works on up to ${SWAP_EDIT_USED_SECONDS}, so the first ${SWAP_EDIT_USED_SECONDS} seconds are used. To use all of it, copy the moves instead (up to ${MAX_SWAP_SECONDS.video}).`;
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

/** Why this video can't be used, or null when it can. */
export const swapLengthProblem = (
  sourceSeconds: number,
  method: SwapMethod,
  orientation: SwapOrientation = DEFAULT_SWAP_ORIENTATION,
) => {
  if (!(sourceSeconds >= MIN_SWAP_SECONDS)) {
    return `The video needs to be at least ${MIN_SWAP_SECONDS} seconds.`;
  }
  // A longer video is cut to its first 15 seconds for replacing, so length never blocks it.
  if (method === "replace") return null;
  const max = MAX_SWAP_SECONDS[orientation];
  if (sourceSeconds > max + 0.5) {
    return orientation === "image"
      ? `Keeping the picture's framing works on videos up to ${max} seconds. Trim it, or follow the video's framing for up to ${MAX_SWAP_SECONDS.video}.`
      : `Trim the video to ${max} seconds or less.`;
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
