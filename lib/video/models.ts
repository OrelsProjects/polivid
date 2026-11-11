import { CAPTIONS_LABEL, CAPTIONS_MODEL } from "./captions";
import { EDIT_LABEL, EDIT_MODEL } from "./edit-ops";
import { LOOP_LABEL, LOOP_MODEL, STILLS_LABEL, STILLS_MODEL } from "./stills";
import { CREDITS_PER_USD } from "@/lib/billing/plans";

/**
 * Video models the creator can pick on the Create page. The prompt is filmed by that model.
 * Most are OpenRouter text-to-video models. Gemini Omni is not on OpenRouter,
 * so it goes straight to Google's Gemini API and needs GEMINI_API_KEY.
 * Kling models go to api-singapore.klingai.com and need KLING_API_KEY.
 * Motion Control is not listed: it needs a performance video.
 */

const seconds = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

const fiveOrTen = [5, 10] as const;

export const GENERATION_MODEL_IDS = [
  "wan",
  "wan-27",
  "happyhorse",
  "hailuo",
  "seedance",
  "seedance-20",
  "flux",
  "omni",
  "kling-4",
  "kling-4-flash",
  "kling",
  "kling-turbo",
  "kling-omni",
  "kling-26",
  "kling-25",
] as const;
export type GenerationModelId = (typeof GENERATION_MODEL_IDS)[number];

export const MODEL_VENDORS = ["Seedance", "Wan", "HappyHorse", "MiniMax", "Kling", "FLUX", "Google"] as const;
export type ModelVendor = (typeof MODEL_VENDORS)[number];

export const VIDEO_PROVIDERS = ["openrouter", "google", "kling"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const isVideoProvider = (value: string): value is VideoProvider =>
  (VIDEO_PROVIDERS as readonly string[]).includes(value);

export type ModelInput = "text" | "image" | "video" | "audio";

export interface GenerationModel {
  id: GenerationModelId;
  vendor: ModelVendor;
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
  /** Input types the provider lists for this model. Output is always video. */
  inputs: readonly ModelInput[];
  /** Accepts an audio_url reference, so a singer's mouth can follow a song. */
  referenceAudio?: boolean;
  /** Turns down reference pictures of real people. */
  refusesRealPeople?: boolean;
  /** Rejects a request that has both a first frame and reference pictures. The first frame wins. */
  noFrameWithReferences?: boolean;
}

export const GENERATION_MODELS: readonly GenerationModel[] = [
  {
    id: "wan",
    vendor: "Wan",
    provider: "openrouter",
    slug: "alibaba/wan-3.0",
    name: "Wan 3.0",
    summary: "Latest Wan, up to 30s with audio",
    detail: "Films the prompt at 720p, about $0.10 a second. The 2 second test uses this model.",
    durations: seconds(2, 30),
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    pricePerSecond: { "480p": 0.0425, "720p": 0.1, "1080p": 0.17 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image", "video", "audio"],
  },
  {
    id: "wan-27",
    vendor: "Wan",
    provider: "openrouter",
    slug: "alibaba/wan-2.7",
    name: "Wan 2.7",
    summary: "Earlier Wan, up to 10s with audio",
    detail: "Films the prompt at 720p, about $0.10 a second. Clips are 2–10 seconds.",
    durations: seconds(2, 10),
    resolutions: ["720p", "1080p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    pricePerSecond: { "720p": 0.1, "1080p": 0.1 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "happyhorse",
    vendor: "HappyHorse",
    provider: "openrouter",
    slug: "alibaba/happyhorse-1.1",
    name: "HappyHorse 1.1",
    summary: "Alibaba's silent clips, 3–15s",
    detail: "Films the prompt at 720p, about $0.10 a second, or 1080p at $0.13. It makes no sound, so add a voiceover or music.",
    durations: seconds(3, 15),
    resolutions: ["720p", "1080p"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "9:21"],
    pricePerSecond: { "720p": 0.0988, "1080p": 0.1278 },
    audio: false,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "hailuo",
    vendor: "MiniMax",
    provider: "openrouter",
    slug: "minimax/hailuo-3",
    name: "MiniMax H3",
    summary: "Realistic motion, up to 15s",
    detail: "Films the prompt at 2K, about $0.13 a second. A 2 second request becomes 5 seconds.",
    durations: seconds(5, 15),
    resolutions: ["2K"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    pricePerSecond: { "2K": 0.13 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image", "video", "audio"],
    referenceAudio: true,
    noFrameWithReferences: true,
  },
  {
    id: "seedance",
    vendor: "Seedance",
    provider: "openrouter",
    slug: "bytedance/seedance-2.5",
    name: "Seedance 2.5",
    summary: "Cinematic scenes, up to 30s",
    detail: "Films the prompt at 720p. A 2 second request becomes 4 seconds.",
    durations: seconds(4, 30),
    resolutions: ["480p", "720p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    pricePerSecond: { "480p": 0.1028, "720p": 0.23112 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image", "video", "audio"],
    referenceAudio: true,
    refusesRealPeople: true,
  },
  {
    id: "seedance-20",
    vendor: "Seedance",
    provider: "openrouter",
    slug: "bytedance/seedance-2.0",
    name: "Seedance 2.0",
    summary: "Previous Seedance, up to 15s",
    detail: "Films the prompt at 720p. Clips are 4–15 seconds, so a 2 second request becomes 4 seconds.",
    durations: seconds(4, 15),
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    pricePerSecond: { "480p": 0.067, "720p": 0.151, "1080p": 0.374 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image", "video", "audio"],
    referenceAudio: true,
    refusesRealPeople: true,
  },
  {
    id: "flux",
    vendor: "FLUX",
    provider: "openrouter",
    slug: "black-forest-labs/flux-3-video",
    name: "FLUX 3",
    summary: "Visual styling, up to 20s",
    detail: "Films the prompt at 720p, about $0.17 a second. A 2 second request becomes 5 seconds.",
    durations: seconds(5, 20),
    resolutions: ["720p", "1080p"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    pricePerSecond: { "720p": 0.17 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image", "video"],
  },
  {
    id: "omni",
    vendor: "Google",
    provider: "google",
    slug: "google/gemini-omni-1.1-flash",
    name: "Omni 1.1 Flash",
    summary: "Gemini Omni, up to 10s",
    detail:
      "Google's Gemini Omni films the prompt at 720p, about $0.10 a second. Portrait or landscape only. A 2 second request becomes 3 seconds.",
    durations: seconds(3, 10),
    resolutions: ["360p", "720p", "1080p", "4k"],
    aspectRatios: ["16:9", "9:16"],
    pricePerSecond: { "720p": 0.1 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "kling-4",
    vendor: "Kling",
    provider: "kling",
    slug: "kling-4.0",
    name: "Kling 4.0",
    summary: "Newest Kling, 3–30s with stereo sound",
    detail: "Films the prompt at 720p, about $0.16 a second, or 1080p at $0.24. It always makes sound and plans its own shots.",
    durations: seconds(3, 30),
    resolutions: ["720p", "1080p"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecond: { "720p": 0.157, "1080p": 0.235 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "kling-4-flash",
    vendor: "Kling",
    provider: "kling",
    slug: "kling-4.0-flash",
    name: "Kling 4.0 Flash",
    summary: "Faster Kling 4.0 at 720p, 3–20s",
    detail: "The quicker Kling 4.0 pass at 720p, about $0.09 a second. It always makes sound.",
    durations: seconds(3, 20),
    resolutions: ["720p"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecond: { "720p": 0.094 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "kling",
    vendor: "Kling",
    provider: "kling",
    slug: "kling-3.0",
    name: "Kling 3.0",
    summary: "Native audio and 4K, 3–15s",
    detail: "Films the prompt at 720p with native audio, about $0.13 a second. 4K is available. A 2 second request becomes 3 seconds.",
    durations: seconds(3, 15),
    resolutions: ["720p", "1080p", "4k"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecond: { "720p": 0.126, "1080p": 0.168, "4k": 0.42 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "kling-turbo",
    vendor: "Kling",
    provider: "kling",
    slug: "kling-3.0-turbo",
    name: "Kling 3.0 Turbo",
    summary: "Fast drafts, 3–15s",
    detail: "The faster Kling 3.0 pass for iteration, at 720p, about $0.11 a second.",
    durations: seconds(3, 15),
    resolutions: ["720p", "1080p"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecond: { "720p": 0.112, "1080p": 0.14 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "kling-omni",
    vendor: "Kling",
    provider: "kling",
    slug: "kling-3.0-omni",
    name: "Kling 3.0 Omni",
    summary: "Same character across clips",
    detail: "Uses reference pictures so a person can stay consistent from clip to clip. 720p with audio is about $0.11 a second.",
    durations: seconds(3, 15),
    resolutions: ["720p", "1080p", "4k"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecond: { "720p": 0.112, "1080p": 0.14, "4k": 0.42 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "kling-26",
    vendor: "Kling",
    provider: "kling",
    slug: "kling-2.6",
    name: "Kling 2.6",
    summary: "Budget clips with audio, 5 or 10s",
    detail: "Previous Kling generation. Native audio is 1080p, about $0.14 a second. Length snaps to 5 or 10 seconds.",
    durations: fiveOrTen,
    resolutions: ["1080p"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecond: { "1080p": 0.14 },
    audio: true,
    referenceImages: true,
    inputs: ["text", "image"],
  },
  {
    id: "kling-25",
    vendor: "Kling",
    provider: "kling",
    slug: "kling-2.5-turbo",
    name: "Kling 2.5 Turbo",
    summary: "Cheapest drafts, 5 or 10s",
    detail: "Silent fast drafts at 720p, about $0.04 a second. Length snaps to 5 or 10 seconds.",
    durations: fiveOrTen,
    resolutions: ["720p", "1080p"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecond: { "720p": 0.042, "1080p": 0.07 },
    audio: false,
    referenceImages: true,
    inputs: ["text", "image"],
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
  generationModelBySlug(slug)?.name ?? CHAT_MODEL_LABELS[slug] ?? (slug === STILLS_MODEL ? STILLS_LABEL : slug === LOOP_MODEL ? LOOP_LABEL : slug === EDIT_MODEL ? EDIT_LABEL : slug === CAPTIONS_MODEL ? CAPTIONS_LABEL : slug);

/** The Create page opens on Wan 3.0 unless POLIVID_MODEL is one of these video slugs. */
export const generationModelIdForSlug = (slug: string): GenerationModelId =>
  generationModelBySlug(slug)?.id ?? DEFAULT_GENERATION_MODEL.id;

export const priceForResolution = (model: GenerationModel, resolution: string) =>
  model.pricePerSecond[resolution];

/** Credits for one dollar of model cost, without a floating-point bump on exact cents. */
const creditsForUsd = (usd: number) => Math.ceil(Number((usd * CREDITS_PER_USD).toFixed(6)));

/** Credits per filmed second. A range when resolutions are priced differently. */
export const creditRateLabel = (model: GenerationModel) => {
  const credits = model.resolutions
    .map((resolution) => priceForResolution(model, resolution))
    .filter((price): price is number => typeof price === "number")
    .map(creditsForUsd);
  if (credits.length === 0) return "";
  const low = Math.min(...credits);
  const high = Math.max(...credits);
  return low === high ? `${low} credits/s` : `${low}–${high} credits/s`;
};

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
