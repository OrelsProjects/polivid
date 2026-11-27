import { z } from "zod";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { filmSecondsFor, lyricsCreditBreakdown, readSongBrief } from "@/lib/music/song-plan";
import { planCuts } from "@/lib/music/shot-plan";
import { GENERATION_MODEL_IDS, generationModelById, type GenerationModel } from "@/lib/video/models";
import { resolveModeTier, VIDEO_TIERS } from "@/lib/video/modes";
import { AUTO_PRESET_ID, MAX_VISUAL_DIRECTION, presetById } from "@/lib/video/presets";
import { planPromptCuts } from "@/lib/video/prompt-shot-plan";
import { skitBeats, skitLookOf, skitLookPreset, skitMayDrawCharacter, skitPlanCuts } from "@/lib/video/skit";
import { planSkit, SkitPlanError } from "@/lib/video/skit-director";
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
  /** Seconds. A skit can leave it out, and its plan picks the length. */
  length: z.number().int().min(MIN_VIDEO_LENGTH).max(MAX_VIDEO_LENGTH).optional(),
  tier: z.enum(VIDEO_TIERS).optional(),
  model: z.enum(GENERATION_MODEL_IDS).optional(),
  mode: z.enum(["prompt", "lyrics", "skit"]).optional().default("lyrics"),
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

  if (mode === "skit") return planSkitShots(parsed.data, model, resolved?.resolution);
  const length = parsed.data.length;
  if (length === undefined) throw new PlanShotsError("Pick a length.", 400);
  if (mode === "prompt") return planPrompt({ ...parsed.data, length }, model, resolved?.resolution);

  const hasSinger = parsed.data.referenceCount > 0;
  const durations = lyricsClipDurations(model, hasSinger);
  const brief = readSongBrief(parsed.data.prompt);
  try {
    const cuts = await planCuts({
      lyrics: brief.lyrics || parsed.data.prompt,
      style: brief.style,
      direction: parsed.data.direction,
      scene: parsed.data.scene,
      length,
      durations,
    });
    const priced = lyricsCreditBreakdown(length, durations, hasSinger, cuts);
    const credits = videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: "lyrics",
      tier: parsed.data.tier,
      modelId: model.id,
      resolution: resolved?.resolution,
      length,
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

/**
 * Plans a skit: a full shot, a length and maybe a sound for each beat, priced. The writer approves
 * it before anything is filmed, and the same plan is what gets filmed.
 */
const planSkitShots = async (data: PlanInput, model: GenerationModel, resolution: string | undefined) => {
  const look = skitLookOf(data.presetId);
  if (!look) throw new PlanShotsError("Pick a look for the skit.", 400);
  const drawn = look !== "own" && look !== "auto" ? skitLookPreset(look) : null;
  let shots;
  try {
    shots = await planSkit({
      script: data.prompt,
      durations: model.durations,
      direction: data.visualDirection,
      target: data.length ?? null,
      lookName: drawn?.name ?? null,
    });
  } catch (error) {
    if (error instanceof SkitPlanError) throw new PlanShotsError(error.message, 400);
    throw error;
  }
  const cuts = skitPlanCuts(shots);
  const seconds = cuts.reduce((sum, cut) => sum + cut.seconds, 0);
  if (seconds > MAX_VIDEO_LENGTH) {
    throw new PlanShotsError(`That skit runs about ${seconds} seconds. The limit is ${MAX_VIDEO_LENGTH}. Shorten the script.`, 400);
  }
  const beats = skitBeats(data.prompt, model.durations);
  return {
    shots: shots.map((shot, index) => ({ ...shot, say: beats[index]?.say ?? "" })),
    seconds,
    credits: videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: "skit",
      tier: data.tier,
      modelId: model.id,
      resolution,
      length: seconds,
      cuts,
      drawsCharacter: skitMayDrawCharacter(look),
    }),
  };
};

const planPrompt = async (data: PlanInput & { length: number }, model: GenerationModel, resolution: string | undefined) => {
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
        ...(cut.action ? { action: cut.action } : {}),
        ...(typeof cut.samePlace === "boolean" ? { samePlace: cut.samePlace } : {}),
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
