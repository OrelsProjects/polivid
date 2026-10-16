import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { getBalance } from "@/lib/billing/credits";
import { videoJobCredits } from "@/lib/billing/estimate";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { startProductionFromInput } from "@/lib/production/create-request";
import { getProductionForUser, listProductionsForUser } from "@/lib/production/store";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { CreateVideoError, queueVideoFromInput } from "@/lib/video/create-request";
import { listCustomPresets } from "@/lib/video/custom-presets";
import { mergeReferenceKeys } from "@/lib/coach/reference-notes";
import { modeAcceptsReferenceImages, VIDEO_MODE_IDS, VIDEO_TIERS, videoModeById } from "@/lib/video/modes";
import { listPresetsFor, MAX_VISUAL_DIRECTION, summarizePreset } from "@/lib/video/presets";
import { suggestPreset } from "@/lib/video/suggest-preset";
import { MAX_PROMPT_LENGTH, MAX_REFERENCE_IMAGES, VIDEO_FORMATS } from "@/lib/video/schema";
import { getVideoForUser, listMyVideos } from "@/lib/videos";
import { listActiveVideoJobs } from "@/lib/video/jobs";
import { listCharacters } from "@/lib/characters/store";
import { isCharacterId, modeCanNarrate, OFF_VOICE_ID } from "@/lib/voice/constants";

const referenceKeySchema = z.array(z.string().trim().min(1).max(200)).max(MAX_REFERENCE_IMAGES).optional();

const createVideoErrorText = (error: CreateVideoError) => {
  if (!error.issues?.length) return error.message;
  const details = error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
  return `${error.message}: ${details}`;
};

const attachedOrRequested = (attached: string, requested: string | undefined, allowed: boolean) => {
  if (!allowed) return OFF_VOICE_ID;
  if (isCharacterId(attached) && attached !== OFF_VOICE_ID) return attached;
  if (isCharacterId(requested)) return requested;
  return OFF_VOICE_ID;
};

export const buildCoachTools = (
  userId: string,
  attachedReferenceKeys: readonly string[] = [],
  attachedVoice = "",
) => ({
  list_characters: tool({
    description: "List saved characters plus studio and off. Use the id as characterId. Only pick a character that has an image.",
    inputSchema: z.object({}),
    execute: async () => {
      const saved = await listCharacters(userId);
      return {
        characters: [
          { id: "off", name: "No added voice", hasImage: false, hasVoice: false },
          { id: "studio", name: "Studio narrator", hasImage: false, hasVoice: true },
          ...saved.map((character) => ({
            id: character.id,
            name: character.name,
            hasImage: character.hasImage,
            hasVoice: character.hasVoice,
          })),
        ],
      };
    },
  }),
  list_presets: tool({
    description: "List visual presets the person can apply to a video.",
    inputSchema: z.object({
      engine: z.enum(["footage", "motion", "both"]).optional().default("footage"),
    }),
    execute: async ({ engine }) => {
      const custom = await listCustomPresets(userId);
      return {
        catalog: listPresetsFor(engine).map(summarizePreset),
        custom: custom.map((preset) => ({ id: preset.id, name: preset.name, tagline: preset.tagline })),
      };
    },
  }),
  suggest_preset: tool({
    description: "Recommend one visual preset from a brief.",
    inputSchema: z.object({
      brief: z.string().min(3),
      engine: z.enum(["footage", "motion"]).optional().default("footage"),
    }),
    execute: async ({ brief, engine }) => {
      const result = await suggestPreset(brief, engine);
      return { preset: summarizePreset(result.preset), reason: result.reason };
    },
  }),
  list_my_videos: tool({
    description: "List the person's generated videos and active jobs.",
    inputSchema: z.object({}),
    execute: async () => {
      const [videos, jobs] = await Promise.all([listMyVideos(), listActiveVideoJobs(userId)]);
      return {
        videos: videos.slice(0, 12).map((video) => ({
          id: video.id,
          title: video.title,
          status: video.status,
          format: video.format,
          length: video.length,
          createdAt: video.createdAt,
        })),
        jobs: jobs.map((job) => ({
          id: job.id,
          status: job.status,
          progressPct: job.progressPct,
          prompt: job.prompt,
        })),
      };
    },
  }),
  get_video: tool({
    description: "Read one of the person's videos.",
    inputSchema: z.object({ videoId: z.string() }),
    execute: async ({ videoId }) => {
      const video = await getVideoForUser(userId, videoId);
      if (!video) return { error: "Video not found." };
      return {
        id: video.id,
        title: video.title,
        prompt: video.prompt,
        status: video.status,
        format: video.format,
        length: video.length,
        error: video.error,
      };
    },
  }),
  list_my_productions: tool({
    description: "List staged productions.",
    inputSchema: z.object({}),
    execute: async () => listProductionsForUser(userId),
  }),
  get_production: tool({
    description: "Read one staged production.",
    inputSchema: z.object({ productionId: z.string() }),
    execute: async ({ productionId }) => {
      const production = await getProductionForUser(userId, productionId);
      if (!production) return { error: "Production not found." };
      return {
        id: production.id,
        title: production.title,
        status: production.status,
        stage: production.stage,
        format: production.format,
        targetDurationSec: production.targetDurationSec,
        presetId: production.presetId,
        error: production.error,
      };
    },
  }),
  get_credit_balance: tool({
    description: "Read remaining credits.",
    inputSchema: z.object({}),
    execute: async () => {
      const balance = await getBalance(userId);
      return { total: balance.total, plan: balance.plan, planCredits: balance.planCredits, bonusCredits: balance.bonusCredits };
    },
  }),
  estimate_credits: tool({
    description: "Estimate credits for a Create video.",
    inputSchema: z.object({
      mode: z.enum(VIDEO_MODE_IDS).optional(),
      tier: z.enum(VIDEO_TIERS).optional(),
      length: z.number().int().min(2).max(90),
    }),
    execute: async ({ mode, tier, length }) => ({
      credits: videoJobCredits({ demo: !hasOpenRouterKey(), mode, tier, length }),
    }),
  }),
  create_video: tool({
    description:
      "Queue a Create video. Requires approval. Spends credits. Pass referenceKeys for prompt and lyrics when the person attached pictures.",
    inputSchema: z.object({
      prompt: z.string().min(3).max(MAX_PROMPT_LENGTH),
      format: z.enum(VIDEO_FORMATS),
      length: z.number().int().min(2).max(90),
      mode: z.enum(VIDEO_MODE_IDS).optional(),
      tier: z.enum(VIDEO_TIERS).optional(),
      showText: z.boolean().optional(),
      presetId: z.string().max(80).optional(),
      visualDirection: z
        .string()
        .max(MAX_VISUAL_DIRECTION)
        .optional()
        .describe(`Look and shot notes, at most ${MAX_VISUAL_DIRECTION} characters.`),
      characterId: z.string().optional(),
      mediaKey: z.string().optional(),
      referenceKeys: referenceKeySchema,
    }),
    execute: async (input) => {
      try {
        const modeId = input.mode ?? "prompt";
        const mode = videoModeById(modeId);
        const referenceKeys =
          mode && modeAcceptsReferenceImages(mode)
            ? mergeReferenceKeys(input.referenceKeys, attachedReferenceKeys)
            : [];
        return await queueVideoFromInput(userId, {
          ...input,
          mode: modeId,
          tier: input.tier ?? "pro",
          referenceKeys: referenceKeys.length > 0 ? referenceKeys : undefined,
          characterId: attachedOrRequested(attachedVoice, input.characterId, modeCanNarrate(modeId)),
        });
      } catch (error) {
        if (error instanceof CreateVideoError) return { error: createVideoErrorText(error) };
        if (error instanceof InsufficientCreditsError) return { error: error.message };
        throw error;
      }
    },
  }),
  start_production: tool({
    description: "Start a staged production. Requires approval. Spends credits.",
    inputSchema: z.object({
      text: z.string().min(3).max(20_000),
      format: z.enum(VIDEO_FORMATS).optional(),
      durationSec: z.number().int().min(5).max(180).optional(),
      mode: z.enum(["review", "auto"]).optional(),
      presetId: z.string().max(80).optional(),
      visualDirection: z
        .string()
        .max(MAX_VISUAL_DIRECTION)
        .optional()
        .describe(`Look and shot notes, at most ${MAX_VISUAL_DIRECTION} characters.`),
      characterId: z.string().optional(),
    }),
    execute: async (input) => {
      try {
        return await startProductionFromInput(userId, {
          ...input,
          characterId: attachedOrRequested(attachedVoice, input.characterId, true),
        });
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Couldn't start that production." };
      }
    },
  }),
  app_ask_question: tool({
    description: "Ask the person a structured question in the chat.",
    inputSchema: z.object({
      question: z.string(),
      options: z.array(z.string()).max(6).optional(),
    }),
  }),
  app_open_create: tool({
    description:
      "Open the Create form with these settings filled in. Does not spend credits. Pass referenceKeys so attached pictures are waiting on the form.",
    inputSchema: z.object({
      prompt: z.string(),
      mode: z.enum(VIDEO_MODE_IDS).optional(),
      format: z.enum(VIDEO_FORMATS).optional(),
      length: z.number().int().optional(),
      tier: z.enum(VIDEO_TIERS).optional(),
      presetId: z.string().optional(),
      visualDirection: z.string().optional(),
      characterId: z.string().optional(),
      referenceKeys: referenceKeySchema,
    }),
  }),
  app_open_video: tool({
    description: "Open one of the person's videos.",
    inputSchema: z.object({ videoId: z.string() }),
  }),
  app_open_production: tool({
    description: "Open one of the person's productions.",
    inputSchema: z.object({ productionId: z.string() }),
  }),
});

export type CoachTools = ReturnType<typeof buildCoachTools>;
