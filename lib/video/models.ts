/**
 * Video models the creator can pick on the Create page. The prompt is filmed by that model.
 * Most are OpenRouter text-to-video models. Gemini Omni is not on OpenRouter,
 * so it goes straight to Google's Gemini API and needs GEMINI_API_KEY.
 */

const seconds = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

export const GENERATION_MODEL_IDS = ["wan", "hailuo", "seedance", "flux", "omni"] as const;
export type GenerationModelId = (typeof GENERATION_MODEL_IDS)[number];

export const VIDEO_PROVIDERS = ["openrouter", "google"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const isVideoProvider = (value: string): value is VideoProvider =>
  (VIDEO_PROVIDERS as readonly string[]).includes(value);

export interface GenerationModel {
  id: GenerationModelId;
  provider: VideoProvider;
  slug: string;
  name: string;
  summary: string;
  detail: string;
  /** Seconds this model accepts. */
  durations: readonly number[];
  resolutions: readonly string[];
  aspectRatios: readonly string[];
  /** USD per generated second, keyed by resolution. Missing keys stay unpublished. */
  pricePerSecond: Record<string, number>;
  audio: boolean;
  /** Accepts OpenRouter input_references images for subject or style. */
  referenceImages: boolean;
}

export const GENERATION_MODELS: readonly GenerationModel[] = [
  {
    id: "wan",
    provider: "openrouter",
    slug: "alibaba/wan-3.0",
    name: "Wan 3.0",
    summary: "Best overall. 2–30 seconds.",
    detail: "Films the prompt at 720p, about $0.10 a second. The 2 second test uses this model.",
    durations: seconds(2, 30),
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    pricePerSecond: { "480p": 0.0425, "720p": 0.1, "1080p": 0.17 },
    audio: true,
    referenceImages: true,
  },
  {
    id: "hailuo",
    provider: "openrouter",
    slug: "minimax/hailuo-3",
    name: "MiniMax H3",
    summary: "Realistic motion. 5–15 seconds.",
    detail: "Films the prompt at 2K, about $0.13 a second. A 2 second request becomes 5 seconds.",
    durations: seconds(5, 15),
    resolutions: ["2K"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    pricePerSecond: { "2K": 0.13 },
    audio: true,
    referenceImages: true,
  },
  {
    id: "seedance",
    provider: "openrouter",
    slug: "bytedance/seedance-2.5",
    name: "Seedance 2.5",
    summary: "Cinematic scenes. 4–30 seconds.",
    detail: "Films the prompt at 720p. A 2 second request becomes 4 seconds.",
    durations: seconds(4, 30),
    resolutions: ["480p", "720p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    pricePerSecond: { "480p": 0.1028, "720p": 0.23112 },
    audio: true,
    referenceImages: true,
  },
  {
    id: "flux",
    provider: "openrouter",
    slug: "black-forest-labs/flux-3-video",
    name: "FLUX 3",
    summary: "Visual styling. 5–20 seconds.",
    detail: "Films the prompt at 720p, about $0.17 a second. A 2 second request becomes 5 seconds.",
    durations: seconds(5, 20),
    resolutions: ["720p", "1080p"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    pricePerSecond: { "720p": 0.17 },
    audio: true,
    referenceImages: true,
  },
  {
    id: "omni",
    provider: "google",
    slug: "google/gemini-omni-1.1-flash",
    name: "Omni 1.1 Flash",
    summary: "Google's Gemini Omni. 3–10 seconds, 16:9 or 9:16.",
    detail:
      "Google's Gemini Omni films the prompt at 720p, about $0.10 a second. Portrait or landscape only. A 2 second request becomes 3 seconds.",
    durations: seconds(3, 10),
    resolutions: ["360p", "720p", "1080p", "4k"],
    aspectRatios: ["16:9", "9:16"],
    pricePerSecond: { "720p": 0.1 },
    audio: true,
    referenceImages: true,
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

export const supportsReferenceImages = (model: GenerationModel) => model.referenceImages;

const CHAT_MODEL_LABELS: Record<string, string> = {
  "anthropic/claude-sonnet-5.5": "Sonnet 5.5",
  "anthropic/claude-opus-5.5": "Opus 5.5",
};

/** Label for a stored slug. Older text-model rows fall back to the slug. */
export const generationModelLabel = (slug: string) =>
  generationModelBySlug(slug)?.name ?? CHAT_MODEL_LABELS[slug] ?? slug;

/** The Create page opens on Wan 3.0 unless POLIVID_MODEL is one of these video slugs. */
export const generationModelIdForSlug = (slug: string): GenerationModelId =>
  generationModelBySlug(slug)?.id ?? DEFAULT_GENERATION_MODEL.id;

export const priceForResolution = (model: GenerationModel, resolution: string) =>
  model.pricePerSecond[resolution];

export const formatPricePerSecond = (price: number | undefined) => {
  if (typeof price !== "number") return "Price varies";
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(price)}/s`;
};

export const maxClipSeconds = (model: GenerationModel) => model.durations.at(-1) ?? 0;
