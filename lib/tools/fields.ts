import { z } from "zod";
import { VIDEO_TIERS } from "@/lib/video/modes";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import {
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGES,
  MAX_VIDEO_LENGTH,
  MIN_VIDEO_LENGTH,
  VIDEO_FORMATS,
} from "@/lib/video/schema";

export const formatField = () =>
  z
    .enum(VIDEO_FORMATS)
    .describe("Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube.");

export const lengthField = (min = MIN_VIDEO_LENGTH, max = MAX_VIDEO_LENGTH) =>
  z.number().int().min(min).max(max).describe(`Length in seconds, from ${min} to ${max}.`);

export const tierField = () =>
  z.enum(VIDEO_TIERS).optional().describe("Quality: low, pro, or ultra. Defaults to pro when omitted.");

export const presetField = () =>
  z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe("Visual preset id from list_presets or suggest_preset. auto lets the model pick.");

export const visualDirectionField = () =>
  z
    .string()
    .trim()
    .max(MAX_VISUAL_DIRECTION)
    .optional()
    .describe(`Look and shot notes, at most ${MAX_VISUAL_DIRECTION} characters.`);

export const characterField = () =>
  z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe("Character id from list_characters: off, studio, or a saved character that has a picture.");

export const referenceKeysField = () =>
  z
    .array(z.string().trim().min(1).max(200))
    .max(MAX_REFERENCE_IMAGES)
    .optional()
    .describe(
      "Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note.",
    );

export const promptField = (description: string) =>
  z.string().trim().min(3).max(MAX_PROMPT_LENGTH).describe(description);

export const optionalPromptField = (description: string) =>
  z.string().trim().max(MAX_PROMPT_LENGTH).optional().describe(description);

export const mediaKeyField = (description: string) =>
  z.string().trim().min(1).max(200).optional().describe(description);

export const idField = (description: string) => z.string().trim().min(1).max(80).describe(description);

/** The line shown on an approval card for a Create video. */
export const videoApprovalDetail = (mode: string) => (input: Record<string, unknown>) => {
  const parts = [mode];
  if (typeof input.format === "string" && input.format) parts.push(input.format);
  if (typeof input.length === "number") parts.push(`${input.length}s`);
  if (typeof input.tier === "string" && input.tier) parts.push(input.tier);
  if (typeof input.presetId === "string" && input.presetId) parts.push(input.presetId);
  if (Array.isArray(input.referenceKeys) && input.referenceKeys.length > 0) parts.push("reference pictures");
  if (typeof input.characterId === "string" && input.characterId && input.characterId !== "off") {
    parts.push("character");
  }
  if (typeof input.mediaKey === "string" && input.mediaKey) parts.push("upload");
  if (typeof input.songId === "string" && input.songId) parts.push("song");
  return parts.join(" · ");
};
