import "server-only";
import { z } from "zod";
import { requireCredits } from "@/lib/billing/credits";
import { getPickableCharacter } from "@/lib/characters/store";
import { mergeCharacterImage } from "@/lib/characters/reference";
import { startPlanning } from "@/lib/production/jobs/coordinator";
import { tickProductionJobs } from "@/lib/production/jobs/runner";
import { plannerProvider } from "@/lib/production/planner";
import { PRODUCTION_MODES } from "@/lib/production/schema";
import { ownedReferenceKeys, referenceAttachments } from "@/lib/production/references";
import { createProductionForUser } from "@/lib/production/store";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import { MAX_REFERENCE_IMAGES, VIDEO_FORMATS } from "@/lib/video/schema";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";

export const CreateProductionSchema = z.object({
  text: z.string().trim().min(3).max(20_000),
  format: z.enum(VIDEO_FORMATS).optional().default("9:16"),
  durationSec: z.number().int().min(5).max(180).optional().default(30),
  mode: z.enum(PRODUCTION_MODES).optional().default("review"),
  creativeDelegation: z.boolean().optional().default(false),
  budgetUsd: z.number().positive().max(500).optional(),
  referenceKeys: z.array(z.string().min(1)).max(MAX_REFERENCE_IMAGES).optional().default([]),
  presetId: z.string().trim().max(80).optional(),
  visualDirection: z.string().trim().max(MAX_VISUAL_DIRECTION).optional().default(""),
  characterId: z.string().trim().max(80).optional().default(""),
});

export const resolveProductionCharacter = async (userId: string, choice: string) => {
  if (!choice || choice === STUDIO_VOICE_ID || choice === OFF_VOICE_ID) {
    return { characterId: null as string | null, imageKey: null as string | null };
  }
  const character = await getPickableCharacter(userId, choice);
  if (!character) throw new Error("Pick a character that has a picture.");
  return { characterId: character.id, imageKey: character.imageKey };
};

export const startProductionFromInput = async (userId: string, raw: unknown) => {
  const parsed = CreateProductionSchema.parse(raw);
  const budgetUsd = parsed.budgetUsd ?? Number(process.env.PRODUCTION_DEFAULT_BUDGET_USD ?? "15");
  const referenceKeys = ownedReferenceKeys(userId, parsed.referenceKeys);
  if (referenceKeys.length !== new Set(parsed.referenceKeys).size) {
    throw new Error("Use pictures from your own library as references.");
  }
  const character = await resolveProductionCharacter(userId, parsed.characterId);
  const attachments = referenceAttachments(mergeCharacterImage(referenceKeys, character.imageKey));
  await requireCredits(userId, 1);
  const id = await createProductionForUser(userId, {
    text: parsed.text,
    format: parsed.format,
    durationSec: parsed.durationSec,
    mode: parsed.mode,
    creativeDelegation: parsed.creativeDelegation,
    plannerProvider: plannerProvider(),
    budgetUsd,
    attachments,
    presetId: parsed.presetId,
    visualDirection: parsed.visualDirection,
    characterId: character.characterId,
  });
  const result = await startPlanning(id, userId);
  void tickProductionJobs();
  return { productionId: id, status: result.status };
};
