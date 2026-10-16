import {
  Captions,
  Clapperboard,
  Image,
  Mic,
  Music,
  Sparkles,
  Type,
  UserRound,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import {
  clipResolution,
  formatPricePerSecond,
  generationModelById,
  generationModelLabel,
  maxClipSeconds,
  priceForResolution,
  type GenerationModel,
  type GenerationModelId,
} from "./models";

export const VIDEO_TIERS = ["low", "pro", "ultra"] as const;
export type VideoTier = (typeof VIDEO_TIERS)[number];

export const VIDEO_MODE_IDS = [
  "voiceover",
  "prompt",
  "motion-graphics",
  "music",
  "avatar",
  "image",
  "av-to-video",
  "lyrics",
  "captions",
] as const;
export type VideoModeId = (typeof VIDEO_MODE_IDS)[number];

export type ModeEngine = "video" | "motion";
export type ModeUpload = "none" | "image" | "audio" | "video" | "media";

export interface ModeTier {
  model?: GenerationModelId;
  chatModel?: string;
  resolution: string;
  strength: string;
}

export interface VideoMode {
  id: VideoModeId;
  title: string;
  description: string;
  icon: LucideIcon;
  tint: string;
  status: "live" | "soon";
  phase: 1 | 2 | 3 | 4 | 5;
  engine: ModeEngine;
  upload: ModeUpload;
  placeholder: string;
  promptOptional?: boolean;
  /** Takes optional reference pictures for subject or style. Every tier model must accept them. */
  referenceImages?: boolean;
  tiers: Record<VideoTier, ModeTier> | null;
}

export const TIER_LABELS: Record<VideoTier, string> = {
  low: "Low",
  pro: "Pro",
  ultra: "Ultra",
};

const T2V_TIERS: Record<VideoTier, ModeTier> = {
  low: { model: "wan", resolution: "480p", strength: "Fast and inexpensive drafts." },
  pro: { model: "hailuo", resolution: "2K", strength: "Realistic motion at high resolution." },
  ultra: { model: "seedance", resolution: "720p", strength: "Cinematic scenes and longer clips." },
};

const IMAGE_TIERS: Record<VideoTier, ModeTier> = {
  low: { model: "wan", resolution: "480p", strength: "Inexpensive first-frame animation." },
  pro: { model: "flux", resolution: "720p", strength: "Keyframe-driven motion." },
  ultra: { model: "seedance", resolution: "720p", strength: "Cinematic motion from a still." },
};

const REFERENCE_TIERS: Record<VideoTier, ModeTier> = {
  low: { model: "seedance", resolution: "480p", strength: "Reference-driven drafts." },
  pro: { model: "seedance", resolution: "720p", strength: "Reference-driven shots." },
  ultra: { model: "seedance", resolution: "720p", strength: "Longer reference-driven clips." },
};

const MOTION_TIERS: Record<VideoTier, ModeTier> = {
  low: { chatModel: "anthropic/claude-sonnet-5.5", resolution: "preview", strength: "Fast scripted scenes." },
  pro: { chatModel: "anthropic/claude-opus-5.5", resolution: "preview", strength: "Richer scene writing." },
  ultra: {
    chatModel: "anthropic/claude-opus-5.5",
    resolution: "preview",
    strength: "Researched, sourced scenes.",
  },
};

export const VIDEO_MODES: readonly VideoMode[] = [
  {
    id: "voiceover",
    title: "Voiceover Video",
    description: "Turn a script or a link into a spoken video with an AI voice.",
    icon: Mic,
    tint: "from-violet-300 to-indigo-100",
    status: "live",
    phase: 3,
    engine: "video",
    upload: "none",
    placeholder: "Paste a script, or a link to an article. Mention the audience if it matters.",
    tiers: T2V_TIERS,
  },
  {
    id: "prompt",
    title: "Prompt to Video",
    description: "Generate a unique clip directly from a text prompt.",
    icon: Sparkles,
    tint: "from-sky-300 to-amber-100",
    status: "live",
    phase: 1,
    engine: "video",
    upload: "none",
    placeholder: "Describe the scene. Mention the audience, the angle, and anything you want on screen.",
    referenceImages: true,
    tiers: T2V_TIERS,
  },
  {
    id: "motion-graphics",
    title: "Motion Graphics Video",
    description: "Build a professional motion-graphics video from a brief.",
    icon: WandSparkles,
    tint: "from-zinc-200 to-slate-100",
    status: "live",
    phase: 5,
    engine: "motion",
    upload: "none",
    placeholder: "Explain the idea. Name any figures you want on screen; numbers still need a source on Ultra.",
    tiers: MOTION_TIERS,
  },
  {
    id: "music",
    title: "Music to Video",
    description: "Turn a song into a music video that follows the track.",
    icon: Music,
    tint: "from-fuchsia-400 to-violet-200",
    status: "live",
    phase: 5,
    engine: "video",
    upload: "audio",
    placeholder: "Describe the visuals. The uploaded track drives the motion.",
    promptOptional: true,
    tiers: REFERENCE_TIERS,
  },
  {
    id: "avatar",
    title: "Talking Avatar",
    description: "Make a talking-avatar video from a photo and a script.",
    icon: UserRound,
    tint: "from-stone-200 to-amber-50",
    status: "live",
    phase: 4,
    engine: "video",
    upload: "image",
    placeholder: "Paste the words this person should say, looking at the camera.",
    tiers: IMAGE_TIERS,
  },
  {
    id: "image",
    title: "Image to Video",
    description: "Animate a still image into a short video clip.",
    icon: Image,
    tint: "from-emerald-200 to-cyan-100",
    status: "live",
    phase: 2,
    engine: "video",
    upload: "image",
    placeholder: "Describe the motion. The picture becomes the first frame.",
    tiers: IMAGE_TIERS,
  },
  {
    id: "av-to-video",
    title: "Audio/Video to Video",
    description: "Find the most relevant clips from an audio or video file.",
    icon: Clapperboard,
    tint: "from-neutral-800 to-zinc-500",
    status: "live",
    phase: 5,
    engine: "video",
    upload: "media",
    placeholder: "Describe the cut you want. The upload is the source footage or audio.",
    promptOptional: true,
    tiers: REFERENCE_TIERS,
  },
  {
    id: "lyrics",
    title: "Lyrics to Music Video",
    description: "Generate a lyrics video from pasted lyrics. Optional pictures can lock a singer or a look.",
    icon: Type,
    tint: "from-rose-400 to-orange-200",
    status: "live",
    phase: 5,
    engine: "video",
    upload: "none",
    placeholder: "Paste the lyrics. Add a photo of the singer if you want that person on screen.",
    referenceImages: true,
    tiers: T2V_TIERS,
  },
  {
    id: "captions",
    title: "Add Captions to Video",
    description: "Add AI-generated captions to an uploaded video.",
    icon: Captions,
    tint: "from-violet-500 to-fuchsia-300",
    status: "live",
    phase: 5,
    engine: "video",
    upload: "video",
    placeholder: "Optional notes. Leave blank to caption the upload as-is.",
    promptOptional: true,
    tiers: REFERENCE_TIERS,
  },
];

export const isVideoModeId = (value: string): value is VideoModeId =>
  (VIDEO_MODE_IDS as readonly string[]).includes(value);

export const isVideoTier = (value: string): value is VideoTier =>
  (VIDEO_TIERS as readonly string[]).includes(value);

export const videoModeById = (id: string) => VIDEO_MODES.find((mode) => mode.id === id) ?? null;

export const modeNeedsUpload = (mode: VideoMode) => mode.upload !== "none";

export const modeAcceptsReferenceImages = (mode: VideoMode) => mode.referenceImages === true;

export const defaultPromptForMode = (mode: VideoMode) => {
  if (mode.id === "captions") return "Add captions to this video.";
  if (mode.id === "music") return "A music video that follows this track.";
  if (mode.id === "av-to-video") return "Edit this source into a short, watchable clip.";
  return "";
};

export interface ResolvedModeTier {
  mode: VideoMode;
  tier: VideoTier;
  mapping: ModeTier;
  model: GenerationModel | null;
  chatModel?: string;
  resolution: string;
}

/** Maps a live mode and tier to the OpenRouter model and resolution. Soon modes return null. */
export const resolveModeTier = (modeId: string, tier: string): ResolvedModeTier | null => {
  const mode = videoModeById(modeId);
  if (!mode || mode.status !== "live" || !mode.tiers) return null;
  if (!isVideoTier(tier)) return null;
  const mapping = mode.tiers[tier];
  const model = mapping.model ? generationModelById(mapping.model) : null;
  if (!model && !mapping.chatModel) return null;
  const resolution =
    model && model.resolutions.includes(mapping.resolution)
      ? mapping.resolution
      : model
        ? clipResolution(model.resolutions)
        : mapping.resolution;
  return { mode, tier, mapping, model, chatModel: mapping.chatModel, resolution };
};

export const describeModeTier = (mapping: ModeTier) => {
  if (mapping.chatModel) {
    return {
      name: generationModelLabel(mapping.chatModel),
      price: "Preview",
      maxLength: 90,
      resolution: mapping.resolution,
    };
  }
  const model = mapping.model ? generationModelById(mapping.model) : null;
  if (!model) {
    return { name: mapping.model ?? "Model", price: "Price varies", maxLength: 0, resolution: mapping.resolution };
  }
  return {
    name: model.name,
    price: formatPricePerSecond(priceForResolution(model, mapping.resolution)),
    maxLength: maxClipSeconds(model),
    resolution: mapping.resolution,
  };
};
