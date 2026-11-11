import { isCharacterId } from "@/lib/voice/constants";
import { backgroundById, DEFAULT_BACKGROUND_ID } from "./backgrounds";
import { editValueFor, isEditOp, type EditOp } from "./edit-ops";
import { GENERATION_MODEL_IDS, type GenerationModelId } from "./models";
import { isVideoTier, type VideoTier } from "./modes";
import { MAX_VISUAL_DIRECTION } from "./presets";
import { isVisualMedia, type VisualMedia } from "./stills";
import {
  isVideoLength,
  MAX_LYRICS_NOTE,
  MAX_LYRICS_REFERENCES,
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGES,
  VIDEO_FORMATS,
  type VideoFormat,
} from "./schema";

export const createDraftStorageKey = (mode?: string) => `polivid:create:${mode ?? "prompt"}`;

export interface CreateDraft {
  prompt: string;
  format: VideoFormat;
  length: number;
  customLength: string;
  model: GenerationModelId;
  tier: VideoTier;
  mediaKey: string | null;
  referenceKeys: string[];
  showText: boolean;
  presetId: string;
  visualDirection: string;
  characterId: string;
  direction: string;
  scene: string;
  directionKeys: string[];
  sceneKeys: string[];
  /** How the video is illustrated. Older drafts have no value and mean filmed. */
  media: VisualMedia;
  verbatim: boolean;
  /** Built-in clip behind a loop video. */
  backgroundId: string;
  /** The person's own clip behind a loop video. */
  backgroundKey: string | null;
  /** The quick edit chosen, and its setting. */
  op: EditOp;
  opValue: string;
}

const isFormat = (value: unknown): value is VideoFormat =>
  typeof value === "string" && (VIDEO_FORMATS as readonly string[]).includes(value);

const isModelId = (value: unknown): value is GenerationModelId =>
  typeof value === "string" && (GENERATION_MODEL_IDS as readonly string[]).includes(value);

const isUploadKey = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("uploads/") && value.length <= 200;

export const parseCreateDraft = (raw: string | null): CreateDraft | null => {
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as unknown;
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const data = record as Record<string, unknown>;
    const prompt = typeof data.prompt === "string" ? data.prompt.slice(0, MAX_PROMPT_LENGTH) : "";
    const format = isFormat(data.format) ? data.format : "9:16";
    const length = typeof data.length === "number" && isVideoLength(data.length) ? data.length : 5;
    const customLength = typeof data.customLength === "string" ? data.customLength.slice(0, 8) : "";
    const model = isModelId(data.model) ? data.model : "wan";
    const tier = typeof data.tier === "string" && isVideoTier(data.tier) ? data.tier : "pro";
    const mediaKey = isUploadKey(data.mediaKey) ? data.mediaKey : null;
    const referenceKeys = Array.isArray(data.referenceKeys)
      ? data.referenceKeys.filter(isUploadKey).slice(0, MAX_REFERENCE_IMAGES)
      : [];
    const showText = data.showText !== false;
    const presetId =
      typeof data.presetId === "string" && data.presetId.trim() && data.presetId.length <= 80
        ? data.presetId.trim()
        : "auto";
    const visualDirection =
      typeof data.visualDirection === "string" ? data.visualDirection.slice(0, MAX_VISUAL_DIRECTION) : "";
    const characterId = isCharacterId(data.characterId)
      ? data.characterId
      : isCharacterId(data.voiceSettingId)
        ? data.voiceSettingId
        : "";
    const op = isEditOp(data.op) ? data.op : "rotate";
    const note = (value: unknown) => (typeof value === "string" ? value.slice(0, MAX_LYRICS_NOTE) : "");
    const pictureKeys = (value: unknown) =>
      Array.isArray(value) ? value.filter(isUploadKey).slice(0, MAX_LYRICS_REFERENCES) : [];
    return {
      prompt,
      format,
      length,
      customLength,
      model,
      tier,
      mediaKey,
      referenceKeys,
      showText,
      presetId,
      visualDirection,
      characterId,
      direction: note(data.direction),
      scene: note(data.scene),
      directionKeys: pictureKeys(data.directionKeys),
      sceneKeys: pictureKeys(data.sceneKeys),
      media: isVisualMedia(data.media) ? data.media : "video",
      verbatim: data.verbatim === true,
      backgroundId: backgroundById(typeof data.backgroundId === "string" ? data.backgroundId : "")?.id ?? DEFAULT_BACKGROUND_ID,
      backgroundKey: isUploadKey(data.backgroundKey) ? data.backgroundKey : null,
      op,
      opValue: editValueFor(op, typeof data.opValue === "string" ? data.opValue : undefined),
    };
  } catch {
    return null;
  }
};

export const readCreateDraft = (mode?: string) => {
  if (typeof window === "undefined") return null;
  try {
    return parseCreateDraft(localStorage.getItem(createDraftStorageKey(mode)));
  } catch {
    return null;
  }
};

export const writeCreateDraft = (draft: CreateDraft, mode?: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(createDraftStorageKey(mode), JSON.stringify(draft));
  } catch {
    // Quota or private mode. The form still works without a saved draft.
  }
};

export const clearCreateDraft = (mode?: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(createDraftStorageKey(mode));
  } catch {
    // Private mode. Ignoring is fine.
  }
};
