import { videoJobCredits } from "@/lib/billing/estimate";
import { proseWithoutBriefEditNote } from "@/lib/coach/brief-edit-notes";
import { proseWithoutModelNote } from "@/lib/coach/model-notes";
import { proseWithoutRunWildNote } from "@/lib/coach/run-wild-notes";
import { proseWithoutVoiceNote } from "@/lib/coach/voice-notes";
import { toolByName } from "@/lib/tools/registry";
import {
  GENERATION_MODEL_IDS,
  generationModelById,
  generationModelBySlug,
  type GenerationModelId,
} from "@/lib/video/models";
import { resolveFilming, resolveModeTier } from "@/lib/video/modes";
import { MAX_CHOSEN_CLIPS, minClipsFor } from "@/lib/video/segments";

export interface CoachBrief {
  mode: string;
  format: string;
  length: string;
  tier: string;
  preset: string;
  /** Footage model id or slug from the brief. Empty when the tier chooses. */
  model: string;
  hook: string;
  beats: string[];
  vo: string;
  cta: string;
  /** Storyboard frame keys, in scene order. Empty when this brief has no frames. */
  frames: string[];
}

const BRIEF_FENCE = /```brief\s*([\s\S]*?)```/i;

/** Sent when the person presses Approve under a brief. The Coach treats it as the go-ahead. */
export const BRIEF_APPROVAL_TEXT = "Approved. Queue it exactly as written in the brief.";

/** A make tool queues the video. A storyboard or a picture in the same reply does not. */
const queuesVideo = (type: string) => {
  if (!type.startsWith("tool-")) return false;
  const definition = toolByName(type.slice("tool-".length));
  return definition?.category === "make" && definition.effects.spendsCredits === true;
};

/** An assistant reply with a brief and no video queued yet, so Approve can go under it. */
export const hasApprovableBrief = (message: {
  role: string;
  parts: readonly { type: string; text?: string }[];
}) =>
  message.role === "assistant" &&
  message.parts.some((part) => part.type === "text" && Boolean(part.text) && BRIEF_FENCE.test(part.text ?? "")) &&
  !message.parts.some((part) => queuesVideo(part.type));

export const briefFromParts = (parts: readonly { type: string; text?: string }[]) => {
  for (const part of parts) {
    if (part.type !== "text" || !part.text) continue;
    const brief = splitCoachContent(part.text).brief;
    if (brief) return brief;
  }
  return null;
};

const namedModelId = (value: string): GenerationModelId | null => {
  const text = value.trim();
  if (!text) return null;
  return generationModelById(text.toLowerCase())?.id ?? generationModelBySlug(text.toLowerCase())?.id ?? null;
};

/** Footage models that can film this brief. Motion graphics has none. */
export const briefModelChoices = (
  brief: CoachBrief,
  available: readonly GenerationModelId[] = GENERATION_MODEL_IDS,
): GenerationModelId[] => {
  const resolved = resolveModeTier(brief.mode, brief.tier);
  if (!resolved?.model || resolved.chatModel) return [];
  return available.filter((id) => {
    const model = generationModelById(id);
    if (!model || !model.aspectRatios.includes(brief.format)) return false;
    if (brief.frames.length > 0 && !model.referenceImages) return false;
    return true;
  });
};

/** The model the card shows: the brief's model when it can film, otherwise the tier's model. */
export const briefModelId = (
  brief: CoachBrief,
  available: readonly GenerationModelId[] = GENERATION_MODEL_IDS,
): GenerationModelId | null => {
  const choices = briefModelChoices(brief, available);
  if (choices.length === 0) return null;
  const named = namedModelId(brief.model);
  if (named && choices.includes(named)) return named;
  const tierId = resolveModeTier(brief.mode, brief.tier)?.model?.id;
  if (tierId && choices.includes(tierId)) return tierId;
  return choices[0] ?? null;
};

/** Tools whose clip count the person can choose. Lyrics plan around the song, and motion graphics do not film clips. */
const CLIP_MODES = new Set(["prompt", "voiceover", "shorts"]);

/**
 * The clip counts this brief can film with, and the one it films by default.
 * A prompt video plans one shot per beat. Other tools film the fewest clips the model needs.
 */
export const briefClipChoices = (brief: CoachBrief, modelId: GenerationModelId | null) => {
  if (!CLIP_MODES.has(brief.mode)) return null;
  const length = Number.parseInt(brief.length, 10);
  if (!Number.isFinite(length) || length <= 0) return null;
  const model = modelId ? generationModelById(modelId) : resolveModeTier(brief.mode, brief.tier)?.model;
  if (!model) return null;
  const least = minClipsFor(length, model.durations);
  const most = Math.max(least, Math.min(MAX_CHOSEN_CLIPS, length));
  const wanted = brief.mode === "prompt" ? Math.max(1, brief.beats.length) : least;
  return { least, most, suggested: Math.min(most, Math.max(least, wanted)) };
};

/** Credits the brief card quotes for a Create video. A production start is priced separately, at one credit. */
export const briefCredits = (brief: CoachBrief, clips?: number) => {
  const length = Number.parseInt(brief.length, 10);
  if (!Number.isFinite(length) || length <= 0) return 0;
  const filming = resolveFilming({
    mode: brief.mode,
    tier: brief.tier,
    modelId: namedModelId(brief.model) ?? undefined,
  });
  return videoJobCredits({
    mode: brief.mode,
    tier: brief.tier,
    length,
    ...(clips ? { clips } : {}),
    ...(filming.model ? { modelId: filming.model.id, resolution: filming.resolution } : {}),
  });
};

/** Every brief waits for Approve. The price no longer decides whether the person sees the button. */
export const briefNeedsApproval = (brief: CoachBrief) => Boolean(brief);

/** The go-ahead the Approve button sends. It is for the model, not a line to show in the chat. */
export const isBriefApprovalMessage = (message: {
  role: string;
  parts: readonly { type: string; text?: string }[];
}) =>
  message.role === "user" &&
  message.parts.length > 0 &&
  message.parts.every((part) => {
    if (part.type !== "text" || !part.text) return false;
    const prose = proseWithoutBriefEditNote(proseWithoutModelNote(proseWithoutRunWildNote(proseWithoutVoiceNote(part.text)))).trim();
    return prose === "" || prose === BRIEF_APPROVAL_TEXT;
  });

export const splitCoachContent = (text: string) => {
  const match = text.match(BRIEF_FENCE);
  if (!match) return { prose: text.trim(), brief: null as CoachBrief | null };
  const prose = `${text.slice(0, match.index).trim()}\n\n${text.slice((match.index ?? 0) + match[0].length).trim()}`.trim();
  return { prose, brief: parseBrief(match[1] ?? "") };
};

const EMPTY_VALUES = new Set(["none", "n/a", "na", "-", "—", "off"]);

const textOrEmpty = (value: string | undefined) => {
  const text = value?.trim() ?? "";
  return EMPTY_VALUES.has(text.toLowerCase()) ? "" : text;
};

const parseBrief = (body: string): CoachBrief => {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    fields[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return {
    mode: fields.mode ?? "prompt",
    format: fields.format ?? "9:16",
    length: fields.length ?? "30",
    tier: fields.tier ?? "pro",
    preset: fields.preset ?? "auto",
    model: textOrEmpty(fields.model),
    hook: textOrEmpty(fields.hook),
    beats: (fields.beats ?? "")
      .split("|")
      .map((beat) => beat.trim())
      .filter(Boolean),
    vo: textOrEmpty(fields.vo),
    cta: textOrEmpty(fields.cta),
    frames: (fields.frames ?? "")
      .split("|")
      .map((key) => key.trim())
      .filter((key) => key.length > 0 && !EMPTY_VALUES.has(key.toLowerCase())),
  };
};
