import "server-only";
import { db } from "@/lib/db";
import { AUTO_PRESET_ID, presetById, styleLockFor, type GenerationPreset } from "./presets";

const customPoster = { from: "#d7dde6", to: "#8a93a3", accent: "#111827" };

export const resolvePreset = async (
  userId: string | null | undefined,
  presetId?: string | null,
): Promise<GenerationPreset | null> => {
  if (!presetId || presetId === AUTO_PRESET_ID) return null;
  const catalog = presetById(presetId);
  if (catalog) return catalog;
  if (!userId) return null;
  const custom = await db.stylePreset.findFirst({ where: { id: presetId, userId } });
  if (!custom) return null;
  return {
    id: custom.id,
    name: custom.name,
    family: "realism",
    tagline: "Your preset",
    promptFragment: custom.promptFragment,
    negativeFragment: custom.negativeFragment ?? "",
    motionNotes: "",
    bestFor: [],
    poster: customPoster,
    appliesTo: "both",
  };
};

export const styleLockForIds = async (
  userId: string | null | undefined,
  presetId?: string | null,
  visualDirection?: string | null,
) => {
  const preset = await resolvePreset(userId, presetId);
  return styleLockFor(preset, visualDirection) || null;
};

export const styleLockForProduction = async (
  presetId?: string | null,
  visualDirection?: string | null,
  userId?: string | null,
) => styleLockForIds(userId, presetId, visualDirection);
