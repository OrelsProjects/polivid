"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clearCreateDraft, readCreateDraft, writeCreateDraft } from "@/lib/video/create-draft";
import { generationModelById, generationModelBySlug, type GenerationModelId } from "@/lib/video/models";
import { DEFAULT_BACKGROUND_ID } from "@/lib/video/backgrounds";
import { EDIT_CHOICES, editValueFor, type EditOp } from "@/lib/video/edit-ops";
import { isVideoTier, modeAllowsMedia, resolveModeTier, type VideoMode, type VideoTier } from "@/lib/video/modes";
import { AUTO_PRESET_ID, defaultPresetIdFor, isPresetId } from "@/lib/video/presets";
import { isVideoLength, MAX_PROMPT_LENGTH, type VideoFormat } from "@/lib/video/schema";
import type { VisualMedia } from "@/lib/video/stills";
import type { CreateTool } from "@/lib/video/tool-catalog";
import { defaultCharacterForMode } from "@/lib/voice/constants";

export const LENGTH_CHOICES = [30, 60, 90] as const;
const DEFAULT_CUSTOM_LENGTH = 5;

const CARRY_FLAG = "polivid:create:carry";
const CARRY_TEXT = "polivid:create:carry-text";

const isFormat = (value: string | null | undefined): value is VideoFormat =>
  value === "9:16" || value === "1:1" || value === "16:9";

const isLengthChoice = (value: number) => (LENGTH_CHOICES as readonly number[]).includes(value);

/** Ask the form being left to hand its text to the next one. Called by the starting-point links. */
export const carryPromptToNextTool = () => {
  try {
    sessionStorage.setItem(CARRY_FLAG, "1");
  } catch {
    // Private mode. The next tool simply starts empty.
  }
};

const takeCarriedPrompt = () => {
  try {
    const text = sessionStorage.getItem(CARRY_TEXT) ?? "";
    sessionStorage.removeItem(CARRY_TEXT);
    sessionStorage.removeItem(CARRY_FLAG);
    return text.slice(0, MAX_PROMPT_LENGTH);
  } catch {
    return "";
  }
};

/** A look the tool does not offer is dropped. Saved looks the person made always pass. */
const presetAllowed = (id: string, offered: readonly string[] | undefined) =>
  !offered || id === AUTO_PRESET_ID || offered.includes(id) || !isPresetId(id);

/**
 * Every field of the create form, with its starting value and its saved draft.
 * A value in the URL wins, then the saved draft, then the tool's defaults, then the mode's.
 */
export function useCreateForm({
  mode,
  tool,
  models,
  defaultModel,
  paused,
}: {
  mode: VideoMode | null;
  tool: CreateTool | null;
  /** Models this server can film with. */
  models: readonly GenerationModelId[];
  defaultModel: GenerationModelId;
  /** True while a request is in flight, so a half-sent form is not saved as the draft. */
  paused: boolean;
}) {
  const searchParams = useSearchParams();
  const defaults = tool?.defaults;
  const draftKey = tool?.slug ?? mode?.id;

  const initialPrompt = searchParams.get("prompt") ?? "";
  const formatParam = searchParams.get("format");
  const lengthParam = Number(searchParams.get("length"));
  const lengthFromUrl = isVideoLength(lengthParam);
  const startLength = lengthFromUrl ? lengthParam : (defaults?.length ?? DEFAULT_CUSTOM_LENGTH);
  const modelParam = searchParams.get("model");
  const requestedModel = modelParam
    ? (generationModelById(modelParam)?.id ?? generationModelBySlug(modelParam)?.id ?? null)
    : null;
  const modelFromUrl = requestedModel && models.includes(requestedModel) ? requestedModel : null;
  const tierParam = searchParams.get("tier");
  const tierFromUrl = tierParam && isVideoTier(tierParam) ? tierParam : null;
  const startTier = tierFromUrl ?? defaults?.tier ?? "pro";
  const tierModel = mode ? resolveModeTier(mode.id, startTier)?.model?.id : null;
  const startPreset =
    defaults?.presetId ?? (mode?.engine === "motion" ? defaultPresetIdFor("motion") : AUTO_PRESET_ID);

  const [prompt, setPrompt] = useState(initialPrompt);
  const [format, setFormat] = useState<VideoFormat>(isFormat(formatParam) ? formatParam : (defaults?.format ?? "9:16"));
  const [length, setLength] = useState(startLength);
  const [customLength, setCustomLength] = useState(isLengthChoice(startLength) ? "" : String(startLength));
  const [model, setModel] = useState<GenerationModelId>(
    modelFromUrl ?? (tierModel && models.includes(tierModel) ? tierModel : defaultModel),
  );
  const [tier, setTier] = useState<VideoTier>(startTier);
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [referenceKeys, setReferenceKeys] = useState<string[]>([]);
  const [showText, setShowText] = useState(defaults?.showText ?? true);
  const [presetId, setPresetId] = useState(startPreset);
  const [visualDirection, setVisualDirection] = useState(defaults?.visualDirection ?? "");
  const [direction, setDirection] = useState("");
  const [scene, setScene] = useState("");
  const [directionKeys, setDirectionKeys] = useState<string[]>([]);
  const [sceneKeys, setSceneKeys] = useState<string[]>([]);
  const [characterId, setCharacterId] = useState(defaults?.characterId ?? defaultCharacterForMode(mode?.id));
  const startMedia = defaults?.media && modeAllowsMedia(mode, defaults.media) ? defaults.media : "video";
  const [media, setMedia] = useState<VisualMedia>(startMedia);
  const [backgroundId, setBackgroundId] = useState(defaults?.backgroundId ?? DEFAULT_BACKGROUND_ID);
  const [backgroundKey, setBackgroundKey] = useState<string | null>(null);
  const [op, setOp] = useState<EditOp>(defaults?.op ?? "rotate");
  const [opValue, setOpValue] = useState(editValueFor(defaults?.op ?? "rotate", defaults?.opValue));
  const [verbatim, setVerbatim] = useState(Boolean(mode?.spokenScript && defaults?.verbatim));
  const [draftReady, setDraftReady] = useState(false);
  /** The person picked a model themselves, so a tier change no longer swaps it. */
  const modelTouched = useRef(Boolean(modelFromUrl));

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate create draft from localStorage after SSR */
    const draft = readCreateDraft(draftKey);
    if (draft) {
      if (!initialPrompt) setPrompt(draft.prompt);
      if (!isFormat(formatParam)) setFormat(draft.format);
      if (!lengthFromUrl) {
        setLength(draft.length);
        setCustomLength(draft.customLength);
      }
      if (!modelFromUrl && models.includes(draft.model)) setModel(draft.model);
      if (!tierFromUrl) setTier(draft.tier);
      if (draft.mediaKey) setMediaKey(draft.mediaKey);
      if (draft.referenceKeys.length > 0) setReferenceKeys(draft.referenceKeys);
      setShowText(draft.showText);
      if (draft.presetId && presetAllowed(draft.presetId, tool?.presets)) setPresetId(draft.presetId);
      if (draft.visualDirection) setVisualDirection(draft.visualDirection);
      if (draft.direction) setDirection(draft.direction);
      if (draft.scene) setScene(draft.scene);
      if (draft.directionKeys.length > 0) setDirectionKeys(draft.directionKeys);
      if (draft.sceneKeys.length > 0) setSceneKeys(draft.sceneKeys);
      if (draft.characterId) setCharacterId(draft.characterId);
      // A tool is defined by its picture type and by whether it reads the script as written.
      // A saved draft changes those only while there is unfinished text to go with them.
      const idle = draft.prompt.trim().length === 0;
      if (!(idle && defaults?.media) && modeAllowsMedia(mode, draft.media)) setMedia(draft.media);
      setBackgroundId(draft.backgroundId);
      if (draft.backgroundKey) setBackgroundKey(draft.backgroundKey);
      // A tool that makes one kind of edit keeps its own. Only the setting is restored.
      if (!tool?.lockOp) setOp(draft.op);
      if (!tool?.lockOp || draft.op === defaults?.op) setOpValue(draft.opValue);
      if (mode?.spokenScript && !(idle && defaults?.verbatim !== undefined)) setVerbatim(draft.verbatim);
    }
    const carried = takeCarriedPrompt();
    if (carried && !initialPrompt && !draft?.prompt) setPrompt((current) => current || carried);
    setDraftReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Restore once from localStorage. URL query params already won on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReady || paused) return;
    writeCreateDraft(
      {
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
        direction,
        scene,
        directionKeys,
        sceneKeys,
        characterId,
        media,
        verbatim,
        backgroundId,
        backgroundKey,
        op,
        opValue,
      },
      draftKey,
    );
  }, [
    draftReady,
    paused,
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
    direction,
    scene,
    directionKeys,
    sceneKeys,
    characterId,
    media,
    verbatim,
    backgroundId,
    backgroundKey,
    op,
    opValue,
    draftKey,
  ]);

  // When a starting-point link is pressed, leave this form's text for the tool it opens.
  const latestPrompt = useRef(prompt);
  useEffect(() => {
    latestPrompt.current = prompt;
  }, [prompt]);
  useLayoutEffect(
    () => () => {
      try {
        if (sessionStorage.getItem(CARRY_FLAG) !== "1") return;
        sessionStorage.setItem(CARRY_TEXT, latestPrompt.current);
      } catch {
        // Private mode. Nothing is carried over.
      }
    },
    [],
  );

  return {
    prompt,
    setPrompt,
    format,
    setFormat,
    length,
    setLength,
    customLength,
    setCustomLength,
    model,
    tier,
    mediaKey,
    setMediaKey,
    referenceKeys,
    setReferenceKeys,
    showText,
    setShowText,
    presetId,
    setPresetId,
    visualDirection,
    setVisualDirection,
    direction,
    setDirection,
    scene,
    setScene,
    directionKeys,
    setDirectionKeys,
    sceneKeys,
    setSceneKeys,
    characterId,
    setCharacterId,
    media,
    setMedia,
    verbatim,
    setVerbatim,
    backgroundId,
    setBackgroundId,
    backgroundKey,
    setBackgroundKey,
    op,
    opValue,
    setOpValue,
    /** Change the edit. Its setting starts on that edit's default. */
    pickOp: (next: EditOp) => {
      setOp(next);
      setOpValue(EDIT_CHOICES[next].defaultValue);
    },
    /** Change tier. The model follows the tier until the person picks one themselves. */
    pickTier: (next: VideoTier) => {
      setTier(next);
      if (modelTouched.current || !mode) return;
      const mapped = resolveModeTier(mode.id, next)?.model?.id;
      if (mapped && models.includes(mapped)) setModel(mapped);
    },
    pickModel: (next: GenerationModelId) => {
      modelTouched.current = true;
      setModel(next);
    },
    clearDraft: () => clearCreateDraft(draftKey),
  };
}
