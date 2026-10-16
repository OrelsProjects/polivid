import type { JobDetailRow, JobInputFields } from "./job-status";
import {
  formatPricePerSecond,
  generationModelBySlug,
  generationModelLabel,
  priceForResolution,
  type GenerationModel,
} from "./models";
import { isVideoTier, TIER_LABELS, videoModeById } from "./modes";
import { presetById } from "./presets";
import { formatClipSplit, isStitchedMode, planSegments } from "./segments";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "../voice/constants";

const PROVIDERS: Record<string, string> = {
  openrouter: "OpenRouter",
  google: "Google",
  anthropic: "Anthropic",
  alibaba: "Alibaba",
  minimax: "MiniMax",
  bytedance: "ByteDance",
  "black-forest-labs": "Black Forest Labs",
};

const providerLabel = (model: GenerationModel | null, slug: string) => {
  if (model) return PROVIDERS[model.provider] ?? model.provider;
  const owner = slug.split("/")[0] ?? "";
  if (!owner || owner === slug) return "";
  return PROVIDERS[owner] ?? "";
};

const characterLabel = (id: string, name: string) => {
  if (!id || id === OFF_VOICE_ID) return "";
  if (id === STUDIO_VOICE_ID) return "Studio voice";
  return name.trim() || "Saved character";
};

const push = (rows: JobDetailRow[], group: JobDetailRow["group"], label: string, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return;
  rows.push({ group, label, value: trimmed });
};

/** Tool and job settings shown from More info. Empty values are left out. */
export const jobDetailRows = (
  job: JobInputFields & { presetName?: string; characterName?: string },
): JobDetailRow[] => {
  const rows: JobDetailRow[] = [];
  const model = generationModelBySlug(job.model);
  push(rows, "Tool", "Name", model?.name ?? (job.model ? generationModelLabel(job.model) : ""));
  push(rows, "Tool", "Provider", providerLabel(model, job.model));
  if (model) {
    push(rows, "Tool", "About", model.summary);
    push(rows, "Tool", "Details", model.detail);
    push(rows, "Tool", "Resolution", job.resolution);
    const price = job.resolution ? priceForResolution(model, job.resolution) : undefined;
    if (typeof price === "number") push(rows, "Tool", "Price", formatPricePerSecond(price));
    push(rows, "Tool", "Audio", model.audio ? "Yes" : "No");
    const shortest = model.durations[0];
    const longest = model.durations.at(-1);
    if (shortest && longest) {
      push(rows, "Tool", "Clip length", shortest === longest ? `${shortest}s` : `${shortest}–${longest}s`);
    }
    push(rows, "Tool", "Model", model.slug);
    if (job.mode === "lyrics") push(rows, "Tool", "Song", "ElevenLabs Music");
  } else if (job.model && job.model !== "editor") {
    push(rows, "Tool", "Model", job.model);
  }

  const mode = videoModeById(job.mode);
  if (mode) {
    push(rows, "This video", "Mode", mode.title);
    push(rows, "This video", "Mode details", mode.description);
  }
  if (isVideoTier(job.tier)) push(rows, "This video", "Quality", TIER_LABELS[job.tier]);
  push(rows, "This video", "Format", job.format);
  if (job.length > 0) push(rows, "This video", "Length", `${job.length}s`);
  const preset = presetById(job.presetId);
  push(rows, "This video", "Style", preset?.name || job.presetName || "");
  if (preset?.tagline) push(rows, "This video", "Style notes", preset.tagline);
  push(rows, "This video", "Visual direction", job.visualDirection);
  push(rows, "This video", "Director", job.direction);
  push(rows, "This video", "Scene", job.scene);
  push(rows, "This video", "Character", characterLabel(job.characterId, job.characterName ?? ""));
  push(rows, "This video", "On-screen words", job.showText ? "Shown" : "Hidden");
  if (job.mode === "lyrics") {
    push(rows, "This video", "Singer lip-sync", job.referenceKeys.length > 0 ? "On" : "Off");
  }
  if (job.referenceKeys.length > 0) {
    const count = job.referenceKeys.length;
    push(rows, "This video", "Reference pictures", count === 1 ? "1 picture" : `${count} pictures`);
  }
  if (model && isStitchedMode(job.mode)) {
    push(rows, "This video", "Clips", formatClipSplit(planSegments(job.length, model.durations)));
  }
  push(rows, "This video", "Prompt", job.prompt);
  return rows;
};
