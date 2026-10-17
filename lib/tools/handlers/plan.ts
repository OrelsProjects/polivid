import "server-only";
import { improveNarration } from "@/lib/ai/improve";
import { polishPresetFragment } from "@/lib/ai/polish-preset";
import { PlanShotsError, planShotsFromInput } from "@/lib/video/plan-shots";
import { createCustomPreset } from "@/lib/video/custom-presets";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, text, toolError } from "./support";

export const planShotsHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const referenceCount =
    typeof row.referenceCount === "number" ? row.referenceCount : ctx.attachedReferenceKeys.length;
  try {
    return await planShotsFromInput({ ...row, referenceCount });
  } catch (error) {
    if (error instanceof PlanShotsError) return { error: error.message };
    throw error;
  }
};

export const improveNarrationHandler: ToolHandler = async (input) => {
  try {
    const script = await improveNarration(text(asRecord(input).description));
    return { script };
  } catch (error) {
    return toolError(error, "Couldn't write that narration.");
  }
};

export const polishLookHandler: ToolHandler = async (input) => {
  try {
    const fragment = await polishPresetFragment(text(asRecord(input).description));
    return { promptFragment: fragment };
  } catch (error) {
    return toolError(error, "Couldn't polish that look.");
  }
};

export const savePresetHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  try {
    const preset = await createCustomPreset(ctx.userId, {
      name: text(row.name),
      promptFragment: text(row.promptFragment),
      negativeFragment: text(row.negativeFragment) || undefined,
    });
    return { id: preset.id, name: preset.name };
  } catch (error) {
    return toolError(error, "Couldn't save that preset.");
  }
};
