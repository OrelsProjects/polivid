import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import {
  AUTO_PRESET_ID,
  DEFAULT_FOOTAGE_PRESET_ID,
  DEFAULT_MOTION_PRESET_ID,
  footagePresetIds,
  listPresetsFor,
  presetById,
  type GenerationPreset,
} from "./presets";

const SUGGEST_MODEL = "anthropic/claude-haiku-5.5";

const SuggestSchema = z.object({
  presetId: z.string(),
  reason: z.string(),
});

/** Picks one catalog preset from a brief. Falls back to Default when the model is unavailable. */
export const suggestPreset = async (
  brief: string,
  engine: "footage" | "motion" = "footage",
): Promise<{ preset: GenerationPreset; reason: string; automatic: boolean }> => {
  const fallbackId = engine === "motion" ? DEFAULT_MOTION_PRESET_ID : DEFAULT_FOOTAGE_PRESET_ID;
  const fallback = presetById(fallbackId)!;
  const candidates = listPresetsFor(engine).filter((entry) => entry.id !== AUTO_PRESET_ID);
  if (!hasOpenRouterKey() || brief.trim().length < 3) {
    return { preset: fallback, reason: "Default style while Auto has no brief to read.", automatic: true };
  }

  try {
    const result = await generateText({
      model: openrouter().chat(SUGGEST_MODEL),
      instructions:
        "Pick the single best visual preset for this video brief. Prefer a style the brief already names. Otherwise pick from bestFor. Never invent an id.",
      prompt: `Brief:\n${brief.trim().slice(0, 2000)}\n\nPresets:\n${candidates
        .map((entry) => `- ${entry.id}: ${entry.name}. ${entry.tagline}. Best for ${entry.bestFor.join(", ")}.`)
        .join("\n")}`,
      output: Output.object({ schema: SuggestSchema, name: "preset" }),
    });
    const chosen = presetById(result.output.presetId);
    if (chosen && chosen.id !== AUTO_PRESET_ID && (chosen.appliesTo === "both" || chosen.appliesTo === engine)) {
      return { preset: chosen, reason: result.output.reason, automatic: true };
    }
    if (engine === "footage" && footagePresetIds().includes(result.output.presetId)) {
      return { preset: presetById(result.output.presetId)!, reason: result.output.reason, automatic: true };
    }
  } catch (error) {
    console.error("Could not suggest a visual preset.", error);
  }
  return { preset: fallback, reason: "Fell back to the default style.", automatic: true };
};
