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
  if (method === "replace") {
    return sourceSeconds > MAX_SWAP_EDIT_SECONDS
      ? `Replacing in a video works up to 15 seconds. Trim it, or copy the moves instead for up to ${MAX_SWAP_SECONDS.video}.`
      : null;
  }
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
