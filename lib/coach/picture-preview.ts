import { isImageKey } from "@/lib/storage/upload-key";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";

export const PICTURE_TOOLS = ["edit_image", "generate_image", "create_character_portrait"] as const;
export type PictureTool = (typeof PICTURE_TOOLS)[number];

/** A new still or an edit spends one credit. */
export const PICTURE_CREDITS = 1;

export const pictureRetryLabel = (credits = PICTURE_CREDITS) =>
  `Retry (${credits} ${credits === 1 ? "credit" : "credits"})`;

export const isPictureTool = (name: string): name is PictureTool =>
  (PICTURE_TOOLS as readonly string[]).includes(name);

export const pictureFormat = (input: Record<string, unknown>): VideoFormat =>
  typeof input.format === "string" && (VIDEO_FORMATS as readonly string[]).includes(input.format)
    ? (input.format as VideoFormat)
    : "1:1";

/** Picture an edit will change: the tool's source, or the first attached picture. */
export const editSourceKey = (input: Record<string, unknown>, attachedKeys: readonly string[]) => {
  const requested = typeof input.sourceKey === "string" ? input.sourceKey.trim() : "";
  if (requested && isImageKey(requested)) return requested;
  return attachedKeys.find((key) => isImageKey(key)) ?? null;
};

export const pictureAlt = (tool: PictureTool, output: unknown) => {
  const prompt =
    output && typeof output === "object" && typeof (output as { prompt?: unknown }).prompt === "string"
      ? (output as { prompt: string }).prompt.replace(/\s+/g, " ").trim()
      : "";
  const detail = prompt.length > 160 ? `${prompt.slice(0, 157)}…` : prompt;
  const title =
    tool === "edit_image" ? "Edited picture" : tool === "create_character_portrait" ? "Character portrait" : "Generated picture";
  return detail ? `${title}: ${detail}` : title;
};

export const pictureWorkingLabel = (tool: PictureTool) =>
  tool === "edit_image" ? "Editing picture" : tool === "create_character_portrait" ? "Generating portrait" : "Generating picture";

/** Edit retries keep the original source when the saved call left it out. */
export const pictureInputForRetry = (
  tool: PictureTool,
  input: Record<string, unknown>,
  attachedKeys: readonly string[],
): Record<string, unknown> => {
  if (tool !== "edit_image") return input;
  if (editSourceKey(input, [])) return input;
  const source = editSourceKey(input, attachedKeys);
  return source ? { ...input, sourceKey: source } : input;
};
