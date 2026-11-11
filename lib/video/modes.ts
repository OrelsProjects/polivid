import {
  Captions,
  Clapperboard,
  Image,
  Mic,
  Music,
  Scissors,
  Smartphone,
  Sparkles,
  Type,
  UserRound,
  WandSparkles,
  Zap,
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
import type { VisualMedia } from "./stills";

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
  "shorts",
  "edit",
  "direct",
] as const;
export type VideoModeId = (typeof VIDEO_MODE_IDS)[number];

/** `compose` modes film nothing: they cut, caption, or assemble what the person already has. */
export type ModeEngine = "video" | "motion" | "compose";
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
  /** What can illustrate this mode. Unset means it is always filmed. */
  media?: readonly VisualMedia[];
  /** The main box holds words to be spoken, so they can be read exactly as written. */
  spokenScript?: boolean;
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

/** Shorts put a real person on camera, so they skip Seedance, which turns down real people. */
const SHORTS_TIERS: Record<VideoTier, ModeTier> = {
  low: { model: "wan", resolution: "480p", strength: "Fast, inexpensive drafts. One clip up to 30 seconds." },
  pro: { model: "hailuo", resolution: "2K", strength: "Realistic presenter motion at high resolution." },
  ultra: { model: "wan", resolution: "1080p", strength: "Sharp 1080p in one clip up to 30 seconds." },
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
    id: "shorts",
    title: "Shorts / TikToks",
    description: "Your character says your script to camera, in the look you pick. Add a background if you want one.",
    icon: Smartphone,
    tint: "from-pink-300 to-violet-200",
    status: "live",
    phase: 3,
    engine: "video",
    upload: "none",
    placeholder: "Paste the script. Your character says it word for word.",
    referenceImages: true,
    tiers: SHORTS_TIERS,
  },
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
    media: ["video", "stills", "loop"],
    spokenScript: true,
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
    description: "Captions drawn into a video you upload, timed to the words as they are spoken.",
    icon: Captions,
    tint: "from-violet-500 to-fuchsia-300",
    status: "live",
    phase: 5,
    engine: "compose",
    upload: "video",
    placeholder: "",
    promptOptional: true,
    tiers: null,
  },
  {
    id: "edit",
    title: "Quick Edit",
    description: "Rotate, flip, resize, loop, or change the volume of a video you upload.",
    icon: Scissors,
    tint: "from-slate-300 to-sky-100",
    status: "live",
    phase: 5,
    engine: "compose",
    upload: "video",
    placeholder: "",
    promptOptional: true,
    tiers: null,
  },
  {
    id: "direct",
    title: "Direct Prompt",
    description: "Your prompt goes to the video model exactly as you typed it. Nothing is planned, rewritten, or added.",
    icon: Zap,
    tint: "from-amber-200 to-lime-100",
    status: "live",
    phase: 5,
    engine: "video",
    upload: "none",
    placeholder: "Write the whole prompt for the video model. It is sent exactly as typed.",
    tiers: T2V_TIERS,
  },
];

/**
 * A direct prompt reaches the video model untouched: no look, no added lines,
 * no shot plan, no voice, and one clip.
 */
export const isDirectMode = (mode?: string | null) => mode === "direct";

export const isVideoModeId = (value: string): value is VideoModeId =>
  (VIDEO_MODE_IDS as readonly string[]).includes(value);

export const isVideoTier = (value: string): value is VideoTier =>
  (VIDEO_TIERS as readonly string[]).includes(value);

export const videoModeById = (id: string) => VIDEO_MODES.find((mode) => mode.id === id) ?? null;

export const modeNeedsUpload = (mode: VideoMode) => mode.upload !== "none";

export const modeAcceptsReferenceImages = (mode: VideoMode) => mode.referenceImages === true;

/** Whether this mode can be made from animated pictures instead of filmed clips. */
export const modeAllowsStills = (mode: VideoMode | null | undefined) => mode?.media?.includes("stills") === true;

/** Whether this mode can be made this way at all. Filming is always allowed. */
export const modeAllowsMedia = (mode: VideoMode | null | undefined, media: VisualMedia) =>
  media === "video" || mode?.media?.includes(media) === true;

export const defaultPromptForMode = (mode: VideoMode) => {
  if (mode.id === "captions") return "Add captions to this video.";
  if (mode.id === "music") return "A music video that follows this track.";
  if (mode.id === "av-to-video") return "Edit this source into a short, watchable clip.";
  if (mode.id === "edit") return "Quick edit";
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
  if (!mode || mode.status !== "live") return null;
  if (!isVideoTier(tier)) return null;
  // Nothing is filmed, so there is no model to pick. The tier is carried but changes nothing.
  if (mode.engine === "compose") {
    return { mode, tier, mapping: { resolution: "", strength: "" }, model: null, resolution: "" };
  }
  if (!mode.tiers) return null;
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

export interface ResolvedFilming {
  model: GenerationModel | null;
  resolution?: string;
  chatModel?: string;
}

/**
 * Footage model for a mode and tier. An explicit model films instead of the tier's model.
 * Motion graphics keeps its chat model. Resolution stays on the tier when that model can film it.
 */
export const resolveFilming = (input: {
  mode?: string;
  tier?: string;
  modelId?: string;
}): ResolvedFilming => {
  const resolved = input.mode && input.tier ? resolveModeTier(input.mode, input.tier) : null;
  if (resolved?.chatModel) {
    return { model: null, chatModel: resolved.chatModel, resolution: resolved.resolution };
  }
  const explicit = input.modelId ? generationModelById(input.modelId) : null;
  const model = explicit ?? resolved?.model ?? null;
  if (!model) return { model: null, resolution: resolved?.resolution };
  if (!explicit || explicit.id === resolved?.model?.id) {
    return { model, resolution: resolved?.resolution ?? clipResolution(model.resolutions) };
  }
  const tierResolution = resolved?.resolution;
  if (
    tierResolution &&
    model.resolutions.includes(tierResolution) &&
    typeof priceForResolution(model, tierResolution) === "number"
  ) {
    return { model, resolution: tierResolution };
  }
  return { model, resolution: clipResolution(model.resolutions) };
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
