import { z } from "zod";
import { MAX_CUT_CAMERA, MAX_CUTS } from "@/lib/music/song-plan";
import { GENERATION_MODEL_IDS } from "@/lib/video/models";
import { VIDEO_MODE_IDS, VIDEO_TIERS } from "@/lib/video/modes";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import { ATTACHMENT_ROLES, MAX_BRIEF_LINE, MAX_DIRECTOR_LINE } from "@/lib/video/shot-plan";
import {
  MAX_LYRICS_NOTE,
  MAX_LYRICS_REFERENCES,
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGES,
  MAX_VIDEO_LENGTH,
  MIN_VIDEO_LENGTH,
  VIDEO_FORMATS,
} from "@/lib/video/schema";

const PromptBriefSchema = z.object({
  subject: z.string().trim().max(MAX_BRIEF_LINE).optional().default(""),
  setting: z.string().trim().max(MAX_BRIEF_LINE).optional().default(""),
  director: z.string().trim().max(MAX_DIRECTOR_LINE).optional().default(""),
  style: z.string().trim().max(MAX_BRIEF_LINE).optional().default(""),
  mustKeep: z.string().trim().max(MAX_BRIEF_LINE).optional().default(""),
  mustAvoid: z.string().trim().max(MAX_BRIEF_LINE).optional().default(""),
});

export const CreateVideoSchema = z.object({
  prompt: z.string().trim().max(MAX_PROMPT_LENGTH).optional().default(""),
  format: z.enum(VIDEO_FORMATS),
  length: z.number().int().min(MIN_VIDEO_LENGTH).max(MAX_VIDEO_LENGTH),
  model: z.enum(GENERATION_MODEL_IDS).optional(),
  mode: z.enum(VIDEO_MODE_IDS).optional(),
  tier: z.enum(VIDEO_TIERS).optional(),
  imageKey: z.string().trim().min(1).max(200).optional(),
  mediaKey: z.string().trim().min(1).max(200).optional(),
  referenceKey: z.string().trim().min(1).max(200).optional(),
  referenceKeys: z.array(z.string().trim().min(1).max(200)).max(MAX_REFERENCE_IMAGES).optional(),
  showText: z.boolean().optional().default(true),
  presetId: z.string().trim().max(80).optional(),
  visualDirection: z.string().trim().max(MAX_VISUAL_DIRECTION).optional().default(""),
  characterId: z.string().trim().max(80).optional().default(""),
  /** An approved song take for a lyrics video. */
  songId: z.string().uuid().optional(),
  /** Camera, pacing, and performance notes for a lyrics video. */
  direction: z.string().trim().max(MAX_LYRICS_NOTE).optional().default(""),
  /** Location, set, and wardrobe for a lyrics video. */
  scene: z.string().trim().max(MAX_LYRICS_NOTE).optional().default(""),
  directionKeys: z.array(z.string().trim().min(1).max(200)).max(MAX_LYRICS_REFERENCES).optional().default([]),
  sceneKeys: z.array(z.string().trim().min(1).max(200)).max(MAX_LYRICS_REFERENCES).optional().default([]),
  /** On-screen cuts for a lyrics video. The server prices and films this list. */
  cuts: z
    .array(
      z.object({
        seconds: z.number().int().min(1).max(MAX_VIDEO_LENGTH),
        camera: z.string().trim().max(MAX_CUT_CAMERA).optional().default(""),
        images: z.array(z.number().int().min(1).max(MAX_REFERENCE_IMAGES)).max(MAX_REFERENCE_IMAGES).optional(),
      }),
    )
    .max(MAX_CUTS)
    .optional(),
  /** How the planner read a prompt video. Ignored outside prompt mode. */
  brief: PromptBriefSchema.optional(),
  attachmentRoles: z
    .array(
      z.object({
        index: z.number().int().min(1).max(MAX_REFERENCE_IMAGES),
        role: z.enum(ATTACHMENT_ROLES),
      }),
    )
    .max(MAX_REFERENCE_IMAGES)
    .optional(),
});

export type CreateVideoInput = z.infer<typeof CreateVideoSchema>;
