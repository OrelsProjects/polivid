import { z } from "zod";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { filmSecondsFor, lyricsCreditBreakdown, readSongBrief } from "@/lib/music/song-plan";
import { planCuts } from "@/lib/music/shot-plan";
import { GENERATION_MODEL_IDS, generationModelById, type GenerationModel } from "@/lib/video/models";
import { resolveModeTier, VIDEO_TIERS } from "@/lib/video/modes";
import { AUTO_PRESET_ID, MAX_VISUAL_DIRECTION, presetById } from "@/lib/video/presets";
import { planPromptCuts } from "@/lib/video/prompt-shot-plan";
import {
  MAX_LYRICS_NOTE,
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGES,
  MAX_VIDEO_LENGTH,
  MIN_VIDEO_LENGTH,
  VIDEO_FORMATS,
} from "@/lib/video/schema";
import { filmedSecondsForCuts } from "@/lib/video/shot-plan";
import { lyricsClipDurations } from "@/lib/video/singer-models";

export class PlanShotsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlanShotsError";
  }
}

const Schema = z.object({
  prompt: z.string().trim().min(3).max(MAX_PROMPT_LENGTH),
  direction: z.string().trim().max(MAX_LYRICS_NOTE).optional().default(""),
  scene: z.string().trim().max(MAX_LYRICS_NOTE).optional().default(""),
  length: z.number().int().min(MIN_VIDEO_LENGTH).max(MAX_VIDEO_LENGTH),
  tier: z.enum(VIDEO_TIERS).optional(),
  model: z.enum(GENERATION_MODEL_IDS).optional(),
  mode: z.enum(["prompt", "lyrics"]).optional().default("lyrics"),
  format: z.enum(VIDEO_FORMATS).optional().default("9:16"),
  referenceCount: z.number().int().min(0).max(MAX_REFERENCE_IMAGES).optional().default(0),
  songReady: z.boolean().optional().default(false),
  visualDirection: z.string().trim().max(MAX_VISUAL_DIRECTION).optional().default(""),
  presetId: z.string().trim().max(80).optional().default(""),
});

type PlanInput = z.infer<typeof Schema>;

/** Plans the cuts for a lyrics or prompt video and prices them. Nothing is filmed or charged. */
export const planShotsFromInput = async (raw: unknown) => {
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) throw new PlanShotsError("Add a few words first.", 400);

  const mode = parsed.data.mode;
  const resolved = parsed.data.tier ? resolveModeTier(mode, parsed.data.tier) : null;
  const model = parsed.data.model ? generationModelById(parsed.data.model) : (resolved?.model ?? null);
  if (!model) throw new PlanShotsError("Pick a quality tier.", 400);

  if (mode === "prompt") return planPrompt(parsed.data, model, resolved?.resolution);

  const hasSinger = parsed.data.referenceCount > 0;
  const durations = lyricsClipDurations(model, hasSinger);
  const brief = readSongBrief(parsed.data.prompt);
  try {
    const cuts = await planCuts({
      lyrics: brief.lyrics || parsed.data.prompt,
      style: brief.style,
      direction: parsed.data.direction,
      scene: parsed.data.scene,
      length: parsed.data.length,
      durations,
    });
    const priced = lyricsCreditBreakdown(parsed.data.length, durations, hasSinger, cuts);
    const credits = videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: "lyrics",
      tier: parsed.data.tier,
      modelId: model.id,
      resolution: resolved?.resolution,
      length: parsed.data.length,
      referenceCount: parsed.data.referenceCount,
      songReady: parsed.data.songReady,
      cuts,
    });
    return {
      cuts: cuts.map((cut) => ({
        seconds: cut.seconds,
        camera: cut.camera,
        filmSec: filmSecondsFor(cut.seconds, durations),
      })),
      filmedSeconds: priced.singerSeconds + priced.brollSeconds,
      credits,
    };
  } catch (error) {
    console.error("Could not plan the shots", error);
    throw new PlanShotsError("Couldn't plan the shots. Try again.", 500);
  }
};

const planPrompt = async (data: PlanInput, model: GenerationModel, resolution: string | undefined) => {
  const preset = presetById(data.presetId);
  const styleNote = preset && preset.id !== AUTO_PRESET_ID ? preset.promptFragment : "";
  try {
    const plan = await planPromptCuts({
      prompt: data.prompt,
      length: data.length,
      durations: model.durations,
      format: data.format,
      referenceCount: data.referenceCount,
      visualDirection: data.visualDirection,
      styleNote,
    });
    const filmedSeconds = filmedSecondsForCuts(data.length, model.durations, plan.cuts);
    const credits = videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: "prompt",
      tier: data.tier,
      modelId: model.id,
      resolution,
      length: data.length,
      referenceCount: data.referenceCount,
      cuts: plan.cuts,
    });
    return {
      brief: plan.brief,
      attachmentRoles: plan.attachmentRoles,
      cuts: plan.cuts.map((cut) => ({
        seconds: cut.seconds,
        camera: cut.camera,
        filmSec: filmSecondsFor(cut.seconds, model.durations),
        ...(cut.images ? { images: cut.images } : {}),
      })),
      filmedSeconds,
      credits,
    };
  } catch (error) {
    console.error("Could not plan the shots", error);
    throw new PlanShotsError("Couldn't plan the shots. Try again.", 500);
  }
};
