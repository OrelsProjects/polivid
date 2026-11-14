import "server-only";
import { z } from "zod";
import { requireCredits } from "@/lib/billing/credits";
import { getPickableCharacter } from "@/lib/characters/store";
import { mergeCharacterPictures } from "@/lib/characters/reference";
import { characterNote, pickReferenceKeys } from "@/lib/characters/media";
import { mediaView } from "@/lib/characters/store";
import { startPlanning } from "@/lib/production/jobs/coordinator";
import { tickProductionJobs } from "@/lib/production/jobs/runner";
import { plannerProvider } from "@/lib/production/planner";
import { PRODUCTION_MODES } from "@/lib/production/schema";
import { ownedReferenceKeys, referenceAttachments } from "@/lib/production/references";
import { createProductionForUser } from "@/lib/production/store";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import { MAX_REFERENCE_IMAGES, VIDEO_FORMATS } from "@/lib/video/schema";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";
import { ProductionHintsSchema, type ProductionHints } from "./hints";

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
  voiceover: z.boolean().optional().default(true),
  hints: ProductionHintsSchema.optional(),
  /** One of the character's looks. */
  characterLookId: z.string().trim().max(80).optional(),
});

export const resolveProductionCharacter = async (userId: string, choice: string, lookId?: string) => {
  if (!choice || choice === STUDIO_VOICE_ID || choice === OFF_VOICE_ID) {
    return { characterId: null as string | null, imageKey: null as string | null, pictures: [] as string[], note: "" };
  }
  const character = await getPickableCharacter(userId, choice);
  if (!character) throw new Error("Pick a character that has a picture.");
  const look = lookId ? character.looks.find((item) => item.id === lookId) : null;
  if (lookId && !look) throw new Error("That look isn't on this character.");
  return {
    characterId: character.id,
    imageKey: character.imageKey,
    pictures: pickReferenceKeys({ mainKey: character.imageKey, media: character.media.map(mediaView), lookId: look?.id }),
    // Productions write scripts too, so the speaking style is part of the note.
    note: characterNote(character, look ?? null, { voice: true }),
  };
};

/** Adds the character note to the planner's notes, keeping anything already there. */
export const hintsWithCharacter = (hints: ProductionHints | undefined, note: string): ProductionHints | undefined => {
  if (!note) return hints;
  const notes = [hints?.notes, `The main character must match this description in every shot. ${note}`].filter(Boolean).join("\n");
  return { ...(hints ?? {}), notes: notes.slice(0, 2000) };
};

export const startProductionFromInput = async (userId: string, raw: unknown) => {
  const parsed = CreateProductionSchema.parse(raw);
  const budgetUsd = parsed.budgetUsd ?? Number(process.env.PRODUCTION_DEFAULT_BUDGET_USD ?? "15");
  const referenceKeys = ownedReferenceKeys(userId, parsed.referenceKeys);
  if (referenceKeys.length !== new Set(parsed.referenceKeys).size) {
    throw new Error("Use pictures from your own library as references.");
  }
  const character = await resolveProductionCharacter(userId, parsed.characterId, parsed.characterLookId);
  const attachments = referenceAttachments(mergeCharacterPictures(referenceKeys, character.pictures));
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
    voiceover: parsed.voiceover,
    hints: hintsWithCharacter(parsed.hints, character.note),
  });
  const result = await startPlanning(id, userId);
  void tickProductionJobs();
  return { productionId: id, status: result.status };
};
