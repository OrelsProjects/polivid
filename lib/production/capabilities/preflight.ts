import type { Shot, StructureOutput, ProductionPlan } from "../schema";
import { capabilityById, defaultVideoCapability, type ModelCapability } from "./registry";

export interface FeatureSet {
  firstFrame: boolean;
  lastFrame: boolean;
  referenceImages: boolean;
  extension: boolean;
  standaloneAudioRef: boolean;
  interactionContext: boolean;
}

export interface PreflightIssue {
  severity: "error" | "warn";
  code: string;
  message: string;
  shotId?: string;
}

export interface PreflightResult {
  ok: boolean;
  issues: PreflightIssue[];
}

const flagsFrom = (set: FeatureSet) => {
  const flags: string[] = [];
  if (set.firstFrame) flags.push("first_frame");
  if (set.lastFrame) flags.push("last_frame");
  if (set.referenceImages) flags.push("reference_images");
  if (set.extension) flags.push("extension");
  if (set.standaloneAudioRef) flags.push("standalone_audio_ref");
  if (set.interactionContext) flags.push("interaction_context");
  return flags;
};

export const featuresForShot = (shot: Shot, model: ModelCapability): FeatureSet => ({
  firstFrame: shot.refs.some((ref) => ref.role === "first_frame") || shot.continuity === "continue_shot",
  lastFrame: shot.refs.some((ref) => ref.role === "last_frame"),
  referenceImages: shot.refs.some((ref) => ref.role === "style_ref" || ref.role === "subject_ref"),
  extension: shot.continuity === "continue_shot",
  standaloneAudioRef: false,
  interactionContext: shot.continuity === "continue_shot" && model.interactionContext,
});

export const checkCapabilityCombo = (model: ModelCapability, features: FeatureSet): PreflightIssue[] => {
  const flags = flagsFrom(features);
  const issues: PreflightIssue[] = [];
  if (features.extension && model.extension === "none") {
    issues.push({
      severity: "error",
      code: "extension_unsupported",
      message: `${model.modelId} cannot continue a shot.`,
    });
  }
  if (features.standaloneAudioRef && !model.standaloneAudioRefs) {
    issues.push({
      severity: "error",
      code: "audio_ref_unsupported",
      message: `${model.modelId} does not accept standalone audio references.`,
    });
  }
  if (features.firstFrame && !model.referenceRoles.includes("first_frame") && !model.inputs.includes("first_frame")) {
    issues.push({
      severity: "error",
      code: "first_frame_unsupported",
      message: `${model.modelId} does not accept a literal starting frame.`,
    });
  }
  for (const constraint of model.constraints) {
    if (constraint.allOf.every((flag) => flags.includes(flag))) {
      issues.push({ severity: "error", code: constraint.id, message: constraint.message });
    }
  }
  return issues;
};

export const preflight = (
  plan: Pick<ProductionPlan, "develop"> & { structure: StructureOutput },
  options: { videoModelId?: string; budgetUsd: number; estimatedUsd: number } = {
    budgetUsd: 10,
    estimatedUsd: 0,
  },
): PreflightResult => {
  const issues: PreflightIssue[] = [];
  const model = options.videoModelId ? capabilityById(options.videoModelId) : defaultVideoCapability();
  if (!model) {
    return {
      ok: false,
      issues: [{ severity: "error", code: "unknown_model", message: `Unknown video model ${options.videoModelId}.` }],
    };
  }

  const neededRefs = new Set<string>();
  for (const shot of plan.structure.shots) {
    const features = featuresForShot(shot, model);
    for (const issue of checkCapabilityCombo(model, features)) {
      issues.push({ ...issue, shotId: shot.id });
    }
    if (model.durations) {
      if (shot.generationDurationSec < model.durations.min || shot.generationDurationSec > model.durations.max) {
        issues.push({
          severity: "error",
          code: "duration_unsupported",
          message: `${model.modelId} accepts ${model.durations.min}–${model.durations.max}s, not ${shot.generationDurationSec}s.`,
          shotId: shot.id,
        });
      }
    }
    const format = plan.develop.requirements.format.value;
    if (model.aspectRatios.length > 0 && !model.aspectRatios.includes(format)) {
      issues.push({
        severity: "error",
        code: "aspect_unsupported",
        message: `${model.modelId} does not film ${format}.`,
        shotId: shot.id,
      });
    }
    for (const ref of shot.refs) {
      if (ref.role === "first_frame" || ref.role === "subject_ref" || ref.role === "style_ref") {
        neededRefs.add(`${ref.targetKind}:${ref.targetId}`);
      }
    }
  }

  for (const character of plan.structure.characters) {
    if (character.referenceAssetIds.length === 0) {
      issues.push({
        severity: "warn",
        code: "missing_character_ref",
        message: `Character ${character.name} has no accepted reference image yet.`,
      });
    }
  }

  for (const segment of plan.structure.audioSegments) {
    if ((segment.track === "dialogue" || segment.track === "narration") && !segment.text) {
      issues.push({
        severity: "error",
        code: "speech_missing_text",
        message: `Speech segment ${segment.id} has no text.`,
      });
    }
  }

  if (options.estimatedUsd > options.budgetUsd) {
    issues.push({
      severity: "error",
      code: "budget",
      message: `Estimated $${options.estimatedUsd.toFixed(2)} exceeds the $${options.budgetUsd.toFixed(2)} budget.`,
    });
  }

  void neededRefs;
  return { ok: issues.every((entry) => entry.severity !== "error"), issues };
};

export const repairPreflightStructure = (structure: StructureOutput, issues: PreflightIssue[]): StructureOutput => {
  const blocked = new Set(
    issues.filter((issue) => issue.code === "omni-no-first-and-refs-mix-unverified" && issue.shotId).map((issue) => issue.shotId as string),
  );
  if (blocked.size === 0) return structure;
  return {
    ...structure,
    shots: structure.shots.map((shot) => {
      if (!blocked.has(shot.id)) return shot;
      return {
        ...shot,
        refs: shot.refs.filter((ref) => ref.role !== "subject_ref" && ref.role !== "style_ref"),
      };
    }),
  };
};
