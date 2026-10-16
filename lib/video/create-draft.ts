import { isCharacterId } from "@/lib/voice/constants";
import { GENERATION_MODEL_IDS, type GenerationModelId } from "./models";
import { isVideoTier, type VideoTier } from "./modes";
import { MAX_VISUAL_DIRECTION } from "./presets";
import {
  isVideoLength,
  MAX_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGES,
  VIDEO_FORMATS,
  type VideoFormat,
} from "./schema";

const INPUT_MODES = ["topic", "article", "data"] as const;
export type CreateDraftInputMode = (typeof INPUT_MODES)[number];

export const createDraftStorageKey = (mode?: string) => `polivid:create:${mode ?? "prompt"}`;

export interface CreateDraft {
  prompt: string;
  inputMode: CreateDraftInputMode;
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
}

const isInputMode = (value: unknown): value is CreateDraftInputMode =>
  typeof value === "string" && (INPUT_MODES as readonly string[]).includes(value);

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
    const inputMode = isInputMode(data.inputMode) ? data.inputMode : "topic";
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
    return {
      prompt,
      inputMode,
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
