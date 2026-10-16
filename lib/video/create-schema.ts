import { z } from "zod";
import { GENERATION_MODEL_IDS } from "@/lib/video/models";
import { VIDEO_MODE_IDS, VIDEO_TIERS } from "@/lib/video/modes";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import {
  MAX_LYRICS_NOTE,
  MAX_LYRICS_REFERENCES,
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGES,
  MAX_VIDEO_LENGTH,
  MIN_VIDEO_LENGTH,
  VIDEO_FORMATS,
} from "@/lib/video/schema";

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
});

export type CreateVideoInput = z.infer<typeof CreateVideoSchema>;
