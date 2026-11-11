import "server-only";
import { writeVoiceover } from "@/lib/ai/voiceover";
import { getUpload, toDataUrl } from "@/lib/storage/s3";
import { isAudioKey, isImageKey, isOwnedUploadKey } from "@/lib/storage/upload-key";
import { OFF_VOICE_ID, modeCanNarrate } from "@/lib/voice/constants";
import { narrationSource, trimToWords, wordsForSeconds } from "./beat-text";
import { writeBeats } from "./beats";
import type { FootageRequest } from "./footage";
import { defaultPromptForMode, isDirectMode, modeAcceptsReferenceImages, videoModeById, type VideoMode } from "./modes";
import { withOnScreenText } from "./on-screen-text";
import { AUTO_PRESET_ID, withVisualStyle, type GenerationPreset } from "./presets";
import { spokenScript } from "./script-markup";
import { suggestPreset } from "./suggest-preset";
import { resolvePreset } from "./style-lock";
import {
  emptyPromptBrief,
  promptShotPrompt,
  promptShotReferences,
  type AttachmentAssignment,
  type PromptBrief,
} from "./shot-plan";
import type { VideoFormat } from "./schema";

export interface PreparedJob {
  prompt: string;
  beats: string[];
  format: VideoFormat;
  length: number;
  model: string;
  resolution?: string;
  imageDataUrl?: string;
  inputReferences?: Record<string, unknown>[];
  transcript?: string;
  reuseUploadAsFootage?: boolean;
  mediaBytes?: Uint8Array;
  spoken?: string;
  /** One spoken line per clip, already trimmed to that clip's length. */
  spokenBeats?: string[];
  /** One reference list per shot. When set, later shots are not left without their pictures. */
  shotReferences?: Record<string, unknown>[][];
}

export const prepareModeJob = async (
  userId: string,
  input: {
    prompt: string;
    format: VideoFormat;
    length: number;
    model: string;
    mode?: string;
    resolution?: string;
    mediaKey?: string;
    referenceKeys?: string[];
    showText?: boolean;
    presetId?: string;
    visualDirection?: string;
    characterId?: string;
    segments?: number[];
    existingBeats?: string[];
    existingSpoken?: string;
    existingSpokenBeats?: string[];
    vo?: string;
    /** Read the script word for word instead of rewriting it to fit the length. */
    verbatim?: boolean;
    cuts?: { seconds: number; camera: string; images?: number[]; action?: string; samePlace?: boolean }[];
    brief?: PromptBrief;
    attachmentRoles?: AttachmentAssignment[];
  },
): Promise<PreparedJob> => {
  const mode = input.mode ? videoModeById(input.mode) : null;
  const media = input.mediaKey ? await readOwnedMedia(userId, input.mediaKey) : null;
  const rawPrompt = (input.prompt.trim() || (mode ? defaultPromptForMode(mode) : "")).trim();
  const savedBeats = input.existingBeats?.filter((beat) => beat.trim().length > 0) ?? [];
  const split = savedBeats.length === 0 && (input.segments?.length ?? 1) > 1;
  // A direct prompt is sent as typed, so no look is chosen for it and nothing is added to it.
  const direct = isDirectMode(mode?.id);
  const preset =
    savedBeats.length > 0 || direct
      ? null
      : await resolveJobPreset({
          userId,
          prompt: rawPrompt,
          mode: mode?.id,
          engine: mode?.engine === "motion" ? "motion" : "footage",
          presetId: input.presetId,
          visualDirection: input.visualDirection,
        });
  const promptPlanned = mode?.id === "prompt" && (input.cuts?.length ?? 0) > 0;
  const brief = input.brief ?? emptyPromptBrief();
  const referencePlan = promptPlanned
    ? (input.cuts ?? []).map((cut) =>
        promptShotReferences({
          keys: input.referenceKeys ?? [],
          roles: input.attachmentRoles ?? [],
          images: cut.images,
        }),
      )
    : [];
  const content =
    savedBeats.length > 0
      ? rawPrompt
      : mode?.id === "voiceover" && !input.verbatim
        ? await writeVoiceover(rawPrompt, input.length)
        : mode?.id === "voiceover"
          ? // Read word for word: notes in brackets and pause marks are directions, not words.
            spokenScript(rawPrompt) || rawPrompt
          : rawPrompt;
  const actions =
    savedBeats.length > 0
      ? savedBeats
      : promptPlanned
        ? (input.cuts ?? []).map((cut, index) =>
            promptShotPrompt({
              brief,
              camera: cut.camera,
              action: "action" in cut ? cut.action : undefined,
              referenceNote: referencePlan[index]?.note ?? "",
              fallbackAction: content,
              continued: index > 0,
              samePlace: "samePlace" in cut ? cut.samePlace === true : false,
            }),
          )
        : mode?.id === "shorts"
          ? (split ? (input.segments ?? []) : [input.length]).map((_, index) =>
              presenterAction(input.referenceKeys?.length ?? 0, index > 0),
            )
          : split
            ? await writeBeats({ prompt: content, segments: input.segments ?? [], mode: mode?.id })
            : [content];
  const lockSinger = mode?.id === "lyrics" && (input.referenceKeys?.length ?? 0) > 0;
  const beats =
    savedBeats.length > 0
      ? savedBeats
      : direct
        ? [rawPrompt]
        : actions.map((action) =>
          dressBeat(action, mode?.id, preset, input.visualDirection, input.showText !== false, lockSinger),
        );
  const prompt =
    beats[0] ??
    (direct ? rawPrompt : dressBeat(content, mode?.id, preset, input.visualDirection, input.showText !== false, lockSinger));
  const voiceOn = Boolean(input.characterId && input.characterId !== OFF_VOICE_ID);
  const spokenBeats = await spokenBeatsFor({
    existing: input.existingSpoken,
    existingBeats: input.existingSpokenBeats,
    voiceOn,
    mode: mode?.id,
    vo: input.vo,
    prompt: rawPrompt,
    voiceover: mode?.id === "voiceover" ? content : "",
    actions: (input.cuts ?? []).map((cut) => ("action" in cut && cut.action?.trim()) || cut.camera || rawPrompt),
    seconds: (input.cuts ?? []).map((cut) => cut.seconds),
    length: input.length,
  });
  const spoken = spokenBeats?.filter(Boolean).join(" ") || undefined;
  const base = {
    prompt,
    beats,
    format: input.format,
    length: input.length,
    model: input.model,
    resolution: input.resolution,
    spoken,
    spokenBeats,
  };

  if (promptPlanned) {
    return {
      ...base,
      shotReferences: await loadShotReferences(
        userId,
        referencePlan.map((plan) => plan.keys),
      ),
    };
  }

  if (!mode || mode.id === "prompt" || mode.id === "lyrics" || mode.id === "shorts") {
    return withReferencePictures(userId, mode, input.referenceKeys, base);
  }

  if (mode.id === "voiceover") return base;

  if (mode.id === "image") {
    if (!media || !isImageKey(input.mediaKey ?? "")) throw new Error("Upload a starting picture.");
    return { ...base, imageDataUrl: media.dataUrl };
  }

  if (mode.id === "avatar") {
    if (!media || !isImageKey(input.mediaKey ?? "")) throw new Error("Upload a photo of the speaker.");
    return {
      ...base,
      prompt: `The person in the reference photo speaks this to camera, looking at the lens, with natural lip sync and a matching voice:\n${prompt}`,
      beats: [
        `The person in the reference photo speaks this to camera, looking at the lens, with natural lip sync and a matching voice:\n${prompt}`,
      ],
      imageDataUrl: media.dataUrl,
    };
  }

  if (mode.id === "music") {
    if (!media || !isAudioKey(input.mediaKey ?? "")) throw new Error("Upload a song.");
    return {
      ...base,
      prompt: `A music video that follows this track. ${prompt}`,
      beats: [`A music video that follows this track. ${prompt}`],
      inputReferences: [audioReference(media)],
    };
  }

  if (mode.id === "av-to-video") {
    if (!media) throw new Error("Upload an audio or video file.");
    return {
      ...base,
      prompt: `Edit this source into a short video. ${prompt}`,
      beats: [`Edit this source into a short video. ${prompt}`],
      inputReferences: [mediaReference(media)],
    };
  }

  return base;
};

const readOwnedMedia = async (userId: string, key: string) => {
  if (!isOwnedUploadKey(userId, key)) throw new Error("That upload is not available.");
  const { bytes, contentType } = await getUpload(key);
  return { bytes, contentType, dataUrl: toDataUrl(bytes, contentType) };
};

const loadShotReferences = async (userId: string, shots: readonly (readonly string[])[]) => {
  const cache = new Map<string, Record<string, unknown>>();
  const loaded: Record<string, unknown>[][] = [];
  for (const keys of shots) {
    const references: Record<string, unknown>[] = [];
    for (const key of keys) {
      let reference = cache.get(key);
      if (!reference) {
        if (!isImageKey(key)) throw new Error("Upload a reference picture.");
        const media = await readOwnedMedia(userId, key);
        reference = { type: "image_url", image_url: { url: media.dataUrl } };
        cache.set(key, reference);
      }
      references.push(reference);
    }
    loaded.push(references);
  }
  return loaded;
};

export const referenceImageDataUrl = async (userId: string, keys: string[] | undefined) => {
  const key = keys?.find((item) => isImageKey(item));
  if (!key) return undefined;
  return (await readOwnedMedia(userId, key)).dataUrl;
};

const audioReference = (media: { dataUrl: string; contentType: string }) => ({
  type: "input_audio",
  input_audio: {
    data: media.dataUrl.replace(/^data:[^;]+;base64,/, ""),
    format: formatFromType(media.contentType),
  },
});

const mediaReference = (media: { dataUrl: string; contentType: string }) => {
  if (media.contentType.startsWith("audio/")) return audioReference(media);
  return { type: "video_url", video_url: { url: media.dataUrl } };
};

const spokenBeatsFor = async (input: {
  existing?: string;
  existingBeats?: string[];
  voiceOn: boolean;
  mode?: string;
  vo?: string;
  prompt: string;
  voiceover: string;
  actions: string[];
  seconds: number[];
  length: number;
}) => {
  const savedBeats = input.existingBeats?.map((beat) => beat.trim()).filter(Boolean) ?? [];
  if (savedBeats.length > 0) return savedBeats;
  const saved = input.existing?.trim() ?? "";
  if (saved) return [saved];
  if (!input.voiceOn || !modeCanNarrate(input.mode)) return undefined;
  const source = narrationSource({
    mode: input.mode,
    vo: input.vo,
    prompt: input.prompt,
    voiceover: input.voiceover,
    actions: input.actions,
  });
  if (!source) return undefined;
  if (input.mode === "lyrics") return [source];
  const seconds = input.seconds.length > 0 ? input.seconds : [input.length];
  const split = await writeBeats({ prompt: source, segments: seconds, mode: "voiceover" });
  const fitted = split.map((beat, index) => trimToWords(beat, wordsForSeconds(seconds[index] ?? input.length)));
  return fitted.some(Boolean) ? fitted : undefined;
};

/**
 * What a Shorts clip films. The script itself is spoken by the character's voice afterwards,
 * so the footage only needs the person talking. The character's picture is always first.
 */
const presenterAction = (pictures: number, continued: boolean) =>
  [
    continued
      ? "The same presenter keeps talking straight to camera in the same place, picking up where the last shot ended."
      : "A presenter talks straight to camera for a vertical social video: steady eye contact, natural expressions, small hand gestures, mouth moving as they speak.",
    pictures > 0 ? "The presenter is the person in the first reference picture. Keep the same face, hair, and clothes." : "",
    pictures > 1 ? "Behind them is the place in the second reference picture. Keep that background." : "",
  ]
    .filter(Boolean)
    .join(" ");

const SINGER_LOCK =
  "The singer is the person in the reference pictures. Keep the same face, hair, and clothes in every shot.";

const withReferencePictures = async (
  userId: string,
  mode: VideoMode | null,
  referenceKeys: string[] | undefined,
  job: PreparedJob,
) => {
  if (!referenceKeys?.length) return job;
  if (mode && !modeAcceptsReferenceImages(mode)) return job;
  const inputReferences = [];
  for (const key of referenceKeys) {
    if (!isImageKey(key)) throw new Error("Upload a reference picture.");
    const reference = await readOwnedMedia(userId, key);
    inputReferences.push({ type: "image_url", image_url: { url: reference.dataUrl } });
  }
  return { ...job, inputReferences };
};

const dressBeat = (
  action: string,
  mode: string | undefined,
  preset: GenerationPreset | null,
  visualDirection: string | undefined,
  showText: boolean,
  lockSinger: boolean,
) => {
  const singer = mode === "lyrics" && lockSinger ? `\n${SINGER_LOCK}` : "";
  const wrapped =
    mode === "lyrics" ? `A lyrics music video. Sing these lyrics and show them on screen:\n${action}${singer}` : action;
  return withOnScreenText(withVisualStyle(wrapped, preset, visualDirection), showText, mode);
};

export const resolveJobPreset = async (input: {
  userId: string;
  prompt: string;
  mode?: string;
  engine: "footage" | "motion";
  presetId?: string;
  visualDirection?: string;
}) => {
  if (input.mode === "captions") return null;
  let preset = await resolvePreset(input.userId, input.presetId);
  if (!preset || preset.id === AUTO_PRESET_ID) {
    const suggested = await suggestPreset(input.prompt, input.engine);
    preset = suggested.preset;
  }
  return preset;
};

const formatFromType = (contentType: string) => {
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("aac") || contentType.includes("mp4")) return "wav";
  return "mp3";
};

export const footageFromPrepared = (prepared: PreparedJob): FootageRequest => ({
  prompt: prepared.prompt,
  format: prepared.format,
  length: prepared.length,
  model: prepared.model,
  resolution: prepared.resolution,
  imageDataUrl: prepared.imageDataUrl,
  inputReferences: prepared.shotReferences
    ? prepared.shotReferences[0]?.length
      ? prepared.shotReferences[0]
      : undefined
    : prepared.inputReferences,
});
