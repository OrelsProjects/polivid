import { z } from "zod";
import {
  clipResolution,
  GENERATION_MODELS,
  generationModelById,
  generationModelBySlug,
  priceForResolution,
  type GenerationModelId,
} from "@/lib/video/models";
import type { StructureOutput } from "./schema";

/** Create models a production shot can film with: the ones the OpenRouter production adapter can run. */
export const PRODUCTION_VIDEO_MODEL_IDS = GENERATION_MODELS.filter((model) => model.provider === "openrouter").map(
  (model) => model.id,
) as GenerationModelId[];

export const isProductionVideoModel = (id: unknown): id is GenerationModelId =>
  typeof id === "string" && (PRODUCTION_VIDEO_MODEL_IDS as string[]).includes(id);

/** Hard constraints an agent or person sets before planning. Every field is optional; unset leaves it to the planner. */
export const ProductionHintsSchema = z.object({
  sceneCount: z.number().int().min(1).max(20).optional(),
  /** Seconds per scene, in order. Its length also sets the scene count. */
  sceneSeconds: z.array(z.number().positive().max(180)).min(1).max(20).optional(),
  /** Longest a single shot may run. */
  maxShotSec: z.number().positive().max(30).optional(),
  music: z.boolean().optional(),
  musicStyle: z.string().trim().max(300).optional(),
  sfx: z.boolean().optional(),
  ambience: z.boolean().optional(),
  /** Speech library voice id (list_voices) for narration. */
  narratorVoiceId: z.string().trim().max(80).optional(),
  transition: z.enum(["cut", "dissolve"]).optional(),
  /** Footage model for every shot, unless a shot sets its own. */
  videoModel: z.string().trim().max(40).optional(),
  /** Footage model per shot id. Kept here, not on the shot, so the planner's output schema is unchanged. */
  shotModels: z.record(z.string(), z.string().trim().max(40)).optional(),
  /** Anything else the planner must follow. */
  notes: z.string().trim().max(2000).optional(),
});
export type ProductionHints = z.infer<typeof ProductionHintsSchema>;

export const hasHints = (hints: ProductionHints | undefined): hints is ProductionHints =>
  Boolean(hints && Object.values(hints).some((value) => value !== undefined && value !== ""));

const lines = (hints: ProductionHints, stage: "develop" | "structure") => {
  const out: string[] = [];
  const count = hints.sceneSeconds?.length ?? hints.sceneCount;
  if (count) out.push(`Exactly ${count} script scene${count === 1 ? "" : "s"}.`);
  if (hints.sceneSeconds) out.push(`Scene lengths in order, in seconds: ${hints.sceneSeconds.join(", ")}. Each scene's estimatedSec must match.`);
  if (stage === "structure" && hints.maxShotSec) out.push(`No shot longer than ${hints.maxShotSec} seconds (editDurationSec and generationDurationSec).`);
  if (hints.music === false) out.push("No music segments.");
  if (hints.music === true) out.push("Include a music segment under the whole film.");
  if (hints.musicStyle) out.push(`Music style: ${hints.musicStyle}.`);
  if (hints.sfx === false) out.push("No sound-effect (sfx) segments.");
  if (hints.sfx === true) out.push("Add sound effects (sfx segments) for the key actions.");
  if (hints.ambience === false) out.push("No ambience segments.");
  if (hints.ambience === true) out.push("Add an ambience bed for each location.");
  if (stage === "structure" && hints.narratorVoiceId) out.push(`Narration segments use voiceId ${hints.narratorVoiceId}.`);
  if (hints.notes) out.push(hints.notes);
  return out;
};

/** Planner note for one pass. Empty when nothing was set. */
export const hintsNote = (hints: ProductionHints | undefined, stage: "develop" | "structure") => {
  if (!hasHints(hints)) return "";
  const rules = lines(hints, stage);
  return rules.length ? `\n\nHARD CONSTRAINTS from the person. Follow every one:\n${rules.map((rule) => `- ${rule}`).join("\n")}` : "";
};

/** Enforces the on/off sound choices and the narrator voice after planning, whatever the planner wrote. */
export const applyHintsToStructure = (structure: StructureOutput, hints: ProductionHints | undefined): StructureOutput => {
  if (!hasHints(hints)) return structure;
  const dropped = new Set(
    structure.audioSegments
      .filter(
        (segment) =>
          (hints.music === false && segment.track === "music") ||
          (hints.sfx === false && segment.track === "sfx") ||
          (hints.ambience === false && segment.track === "ambience"),
      )
      .map((segment) => segment.id),
  );
  const voiced = hints.narratorVoiceId;
  return {
    ...structure,
    audioSegments: structure.audioSegments
      .filter((segment) => !dropped.has(segment.id))
      .map((segment) =>
        voiced && segment.track === "narration" ? { ...segment, voiceId: voiced } : segment,
      )
      .map((segment) => (hints.musicStyle && segment.track === "music" && !segment.prompt ? { ...segment, prompt: hints.musicStyle } : segment)),
    shots: structure.shots.map((shot) => ({
      ...shot,
      audioSegmentIds: shot.audioSegmentIds.filter((id) => !dropped.has(id)),
      ...(hints.maxShotSec
        ? {
            editDurationSec: Math.min(shot.editDurationSec, hints.maxShotSec),
            generationDurationSec: Math.min(shot.generationDurationSec, hints.maxShotSec),
          }
        : {}),
    })),
  };
};

/** Reads the hints saved on a production's input record. Bad or missing values read as none. */
export const readHints = (raw: unknown): ProductionHints => {
  const parsed = ProductionHintsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
};

/** The Create model slug a shot films with, or null to use the production default. */
export const shotModelSlug = (shotId: string, hints: ProductionHints | undefined) => {
  const id = hints?.shotModels?.[shotId] || hints?.videoModel;
  if (!isProductionVideoModel(id)) return null;
  return generationModelById(id)?.slug ?? null;
};

/** Per-second price of the model a shot was given, for the cost estimate. */
export const shotUsdPerSecFor = (hints: ProductionHints | undefined) => (shotId: string) => {
  const slug = shotModelSlug(shotId, hints);
  const model = slug ? generationModelBySlug(slug) : null;
  if (!model) return undefined;
  const usd = priceForResolution(model, clipResolution(model.resolutions));
  return typeof usd === "number" ? usd : undefined;
};
