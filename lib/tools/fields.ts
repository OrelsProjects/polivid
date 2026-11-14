import { z } from "zod";
import { MAX_CUT_CAMERA, MAX_CUTS } from "@/lib/music/song-plan";
import { GENERATION_MODEL_IDS } from "@/lib/video/models";
import { VIDEO_TIERS } from "@/lib/video/modes";
import { ATTACHMENT_ROLES, MAX_BRIEF_LINE, MAX_DIRECTOR_LINE } from "@/lib/video/shot-plan";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import {
  MAX_LYRICS_REFERENCES,
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
  if (typeof input.model === "string" && input.model) parts.push(input.model);
  if (typeof input.media === "string" && input.media && input.media !== "video") parts.push(input.media);
  if (Array.isArray(input.cuts) && input.cuts.length > 0) parts.push(`${input.cuts.length} shots`);
  else if (typeof input.clips === "number") parts.push(`${input.clips} clips`);
  if (typeof input.presetId === "string" && input.presetId) parts.push(input.presetId);
  if (Array.isArray(input.referenceKeys) && input.referenceKeys.length > 0) parts.push("reference pictures");
  if (typeof input.characterId === "string" && input.characterId && input.characterId !== "off") {
    parts.push("character");
  }
  if (typeof input.mediaKey === "string" && input.mediaKey) parts.push("upload");
  if (typeof input.songId === "string" && input.songId) parts.push("song");
  return parts.join(" · ");
};

// ---------- Fields that mirror CreateVideoSchema (lib/video/create-schema.ts) ----------

export const modelField = () =>
  z
    .enum(GENERATION_MODEL_IDS)
    .optional()
    .describe(
      "Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first.",
    );

export const clipsField = () =>
  z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe("How many clips (shots) to film, 1 to 12. Omit to let the planner use the fewest the model needs.");

export const cutsField = () =>
  z
    .array(
      z.object({
        seconds: z.number().int().min(1).max(MAX_VIDEO_LENGTH).describe("Length of this shot in seconds. Must be a length the model films (list_models)."),
        camera: z.string().trim().max(MAX_CUT_CAMERA).optional().describe("Camera for this shot, e.g. slow push-in, handheld, overhead."),
        action: z.string().trim().max(400).optional().describe("What happens in this shot."),
        samePlace: z.boolean().optional().describe("True to keep the previous shot's location."),
        images: z
          .array(z.number().int().min(1).max(MAX_REFERENCE_IMAGES))
          .max(MAX_REFERENCE_IMAGES)
          .optional()
          .describe("Which reference pictures (1-based, in referenceKeys order) this shot uses."),
      }),
    )
    .max(MAX_CUTS)
    .optional()
    .describe(
      "Your own shot list, in order. Sets the number of shots and each one's length and camera, and skips the automatic planner. The seconds should add up to length.",
    );

export const briefField = () =>
  z
    .object({
      subject: z.string().trim().max(MAX_BRIEF_LINE).optional().describe("Who or what the video is about."),
      setting: z.string().trim().max(MAX_BRIEF_LINE).optional().describe("Where it happens."),
      director: z.string().trim().max(MAX_DIRECTOR_LINE).optional().describe("Overall direction for the shots."),
      style: z.string().trim().max(MAX_BRIEF_LINE).optional().describe("Look and style."),
      mustKeep: z.string().trim().max(MAX_BRIEF_LINE).optional().describe("Things every shot must keep."),
      mustAvoid: z.string().trim().max(MAX_BRIEF_LINE).optional().describe("Things no shot may show."),
    })
    .optional()
    .describe("How to read the prompt. Only used together with cuts.");

export const attachmentRolesField = () =>
  z
    .array(
      z.object({
        index: z.number().int().min(1).max(MAX_REFERENCE_IMAGES).describe("1-based position in referenceKeys."),
        role: z.enum(ATTACHMENT_ROLES).describe("What that picture is for."),
      }),
    )
    .max(MAX_REFERENCE_IMAGES)
    .optional()
    .describe(`What each reference picture is: ${ATTACHMENT_ROLES.join(", ")}. Only used together with cuts.`);

export const showTextField = () =>
  z.boolean().optional().describe("Whether on-screen text and titles are allowed. Defaults to yes.");

export const templateField = () =>
  z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional()
    .describe("Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings.");

export const sourceUrlField = () =>
  z.string().trim().url().max(2000).optional().describe("The page the script came from, kept as a record on the video.");

export const pictureKeysField = (description: string) =>
  z.array(z.string().trim().min(1).max(200)).max(MAX_LYRICS_REFERENCES).optional().describe(description);
