/**
 * Video models the creator can pick on the Create page.
 * Each one is an OpenRouter text-to-video model. The prompt is filmed by that model.
 * Gemini Omni Flash 1.1 is not on OpenRouter, so it is not listed.
 */

const seconds = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

export const GENERATION_MODEL_IDS = ["wan", "hailuo", "seedance", "flux"] as const;
export type GenerationModelId = (typeof GENERATION_MODEL_IDS)[number];

export interface GenerationModel {
  id: GenerationModelId;
  slug: string;
  name: string;
  summary: string;
  detail: string;
  /** Seconds this model accepts. */
  durations: readonly number[];
  resolutions: readonly string[];
  aspectRatios: readonly string[];
  audio: boolean;
}

export const GENERATION_MODELS: readonly GenerationModel[] = [
  {
    id: "wan",
    slug: "alibaba/wan-3.0",
    name: "Wan 3.0",
    summary: "Best overall. 2–30 seconds.",
    detail: "Films the prompt at 720p, about $0.10 a second. The 2 second test uses this model.",
    durations: seconds(2, 30),
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    audio: true,
  },
  {
    id: "hailuo",
    slug: "minimax/hailuo-3",
    name: "MiniMax H3",
    summary: "Realistic motion. 5–15 seconds.",
    detail: "Films the prompt at 2K, about $0.13 a second. A 2 second request becomes 5 seconds.",
    durations: seconds(5, 15),
    resolutions: ["2K"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    audio: true,
  },
  {
    id: "seedance",
    slug: "bytedance/seedance-2.5",
    name: "Seedance 2.5",
    summary: "Cinematic scenes. 4–30 seconds.",
    detail: "Films the prompt at 720p. A 2 second request becomes 4 seconds.",
    durations: seconds(4, 30),
    resolutions: ["480p", "720p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    audio: true,
  },
  {
    id: "flux",
    slug: "black-forest-labs/flux-3-video",
    name: "FLUX 3",
    summary: "Visual styling. 5–20 seconds.",
    detail: "Films the prompt at 720p, about $0.17 a second. A 2 second request becomes 5 seconds.",
    durations: seconds(5, 20),
    resolutions: ["720p", "1080p"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    audio: true,
  },
];

export const DEFAULT_GENERATION_MODEL = GENERATION_MODELS[0];

/** Longest clip the model will make that is still within the requested length. */
export const clipDuration = (requested: number, allowed: readonly number[]) => {
  const sorted = [...allowed].sort((a, b) => a - b);
  if (sorted.length === 0) return requested;
  if (sorted.includes(requested)) return requested;
  const fits = sorted.filter((duration) => duration <= requested);
  return fits.at(-1) ?? sorted[0];
};

/** 720p when the model has it, otherwise its first listed resolution. */
export const clipResolution = (resolutions: readonly string[]) => {
  const preferred = ["720p", "768p", "1080p", "2K", "480p"];
  return preferred.find((resolution) => resolutions.includes(resolution)) ?? resolutions[0] ?? "720p";
};

export const generationModelById = (id: string) =>
  GENERATION_MODELS.find((model) => model.id === id) ?? null;

export const generationModelBySlug = (slug: string) =>
  GENERATION_MODELS.find((model) => model.slug === slug) ?? null;

/** Label for a stored slug. Older text-model rows fall back to the slug. */
export const generationModelLabel = (slug: string) => generationModelBySlug(slug)?.name ?? slug;

/** The Create page opens on Wan 3.0 unless POLIVID_MODEL is one of these video slugs. */
export const generationModelIdForSlug = (slug: string): GenerationModelId =>
  generationModelBySlug(slug)?.id ?? DEFAULT_GENERATION_MODEL.id;
