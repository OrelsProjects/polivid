import "server-only";
import { z } from "zod";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { isAudioKey, isImageKey, isMediaKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import { isGenerationModelAvailable } from "@/lib/video/available-models";
import { createQueuedVideoJob } from "@/lib/video/jobs";
import { clipDuration } from "@/lib/video/models";
import {
  defaultPromptForMode,
  isDirectMode,
  modeAcceptsReferenceImages,
  modeAllowsMedia,
  modeNeedsUpload,
  resolveFilming,
  resolveModeTier,
} from "@/lib/video/modes";
import { CreateVideoSchema } from "@/lib/video/create-schema";
import { toolBySlug } from "@/lib/video/tool-catalog";
import {
  MAX_LYRICS_REFERENCES,
  MAX_REFERENCE_IMAGES,
  MIN_VIDEO_LENGTH,
  VIDEO_FORMATS,
  type VideoFormat,
} from "@/lib/video/schema";
import { backgroundById, DEFAULT_BACKGROUND_ID } from "@/lib/video/backgrounds";
import { closestFormat, CAPTIONS_MODEL, MAX_CAPTION_SECONDS } from "@/lib/video/captions";
import { probeUpload } from "@/lib/video/compose/upload-file";
import {
  describeEdit,
  EDIT_MODEL,
  editFormat,
  editLengthFactor,
  editValueFor,
  isEditValue,
  type EditOp,
} from "@/lib/video/edit-ops";
import { scriptSize, stillPictureCount } from "@/lib/video/script-markup";
import { LOOP_MODEL, maxLengthForMedia, STILLS_MODEL } from "@/lib/video/stills";
import { getPickableCharacter } from "@/lib/characters/store";
import { mergeCharacterImage } from "@/lib/characters/reference";
import { OFF_VOICE_ID, STUDIO_VOICE_ID, modeCanNarrate } from "@/lib/voice/constants";
import { readSongDraft, songCharacterId, songDraftFits } from "@/lib/music/song-draft";
import { normalizeCuts, readSongBrief, type SongCut } from "@/lib/music/song-plan";
import { planCuts } from "@/lib/music/shot-plan";
import { AUTO_PRESET_ID, presetById } from "@/lib/video/presets";
import { planPromptCuts } from "@/lib/video/prompt-shot-plan";
import { promptPlanFromOutput, type AttachmentAssignment, type PromptBrief } from "@/lib/video/shot-plan";
import { lyricsClipDurations } from "@/lib/video/singer-models";

export { CreateVideoSchema, type CreateVideoInput } from "@/lib/video/create-schema";

export class CreateVideoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: z.ZodError["issues"],
  ) {
    super(message);
    this.name = "CreateVideoError";
  }
}

export const queueVideoFromInput = async (userId: string, raw: unknown) => {
  const parsed = CreateVideoSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CreateVideoError("Invalid request", 400, parsed.error.issues);
  }

  const resolved = parsed.data.mode ? resolveModeTier(parsed.data.mode, parsed.data.tier ?? "") : null;
  if (parsed.data.mode && !parsed.data.tier) {
    throw new CreateVideoError("Pick a quality tier.", 400);
  }
  if (parsed.data.mode && !resolved) {
    throw new CreateVideoError("This mode is coming soon.", 400);
  }
  const tool = parsed.data.tool ? toolBySlug(parsed.data.tool) : null;
  if (parsed.data.tool && (!tool || tool.mode !== resolved?.mode.id)) {
    throw new CreateVideoError("That tool isn't available. Pick one from the Tools page.", 400);
  }

  const mediaKey = parsed.data.mediaKey ?? parsed.data.imageKey;
  if (resolved && modeNeedsUpload(resolved.mode) && resolved.mode.upload !== "none") {
    const missing = missingUpload(resolved.mode.upload, userId, mediaKey);
    if (missing) throw new CreateVideoError(missing, 400);
  }

  const prompt =
    parsed.data.prompt || (resolved?.mode.promptOptional ? defaultPromptForMode(resolved.mode) : "");
  if (prompt.length < 3) {
    throw new CreateVideoError("Write a few words first.", 400);
  }

  if (resolved?.mode.id === "edit") {
    return queueEdit(userId, { key: mediaKey ?? "", op: parsed.data.op, opValue: parsed.data.opValue, tool: tool?.slug });
  }

  if (resolved?.mode.id === "captions") {
    return queueCaptions(userId, { key: mediaKey ?? "", tool: tool?.slug });
  }

  const media = parsed.data.media ?? "video";
  if (!modeAllowsMedia(resolved?.mode, media)) {
    throw new CreateVideoError("This tool films its pictures. Pick Filmed clips for it.", 400);
  }
  const stills = media === "stills";
  const loop = media === "loop";
  /** Drawn or looped pictures: no footage model films this video. */
  const composed = stills || loop;
  const maxLength = maxLengthForMedia(media);
  const verbatim = parsed.data.verbatim === true && resolved?.mode.spokenScript === true;
  let length = parsed.data.length;
  if (verbatim) {
    // Notes and pauses in the script are not words. Pauses still take time.
    const size = scriptSize(prompt);
    if (size.words === 0) throw new CreateVideoError("Write the words to read. Notes in brackets are not read aloud.", 400);
    const seconds = size.seconds;
    if (seconds > maxLength) {
      throw new CreateVideoError(
        `That script takes about ${seconds} seconds to read. The limit is ${maxLength}. Shorten it, or let us fit it to a length.`,
        400,
      );
    }
    length = Math.max(MIN_VIDEO_LENGTH, seconds);
  }
  if (length > maxLength) {
    throw new CreateVideoError(`Pick a length of ${maxLength} seconds or less.`, 400);
  }

  let backgroundId: string | undefined;
  let backgroundKey: string | undefined;
  if (loop) {
    if (parsed.data.backgroundKey) {
      if (!isOwnedUploadKey(userId, parsed.data.backgroundKey) || !isVideoKey(parsed.data.backgroundKey)) {
        throw new CreateVideoError("Upload a video clip to use as the background.", 400);
      }
      backgroundKey = parsed.data.backgroundKey;
    } else {
      const picked = backgroundById(parsed.data.backgroundId ?? DEFAULT_BACKGROUND_ID);
      if (!picked) throw new CreateVideoError("Pick a background.", 400);
      backgroundId = picked.id;
    }
  }

  const filming = resolveFilming({
    mode: parsed.data.mode,
    tier: parsed.data.tier,
    modelId: parsed.data.model,
  });
  const videoModel = filming.chatModel || composed ? null : filming.model;
  const modelSlug = stills ? STILLS_MODEL : loop ? LOOP_MODEL : (filming.chatModel ?? videoModel?.slug);
  const modelOverridden = Boolean(
    parsed.data.mode && parsed.data.model && videoModel && videoModel.id !== resolved?.model?.id,
  );
  const resolution = modelOverridden ? filming.resolution : resolved?.resolution;
  if (!modelSlug) throw new CreateVideoError("Pick a generation model and try again.", 400);
  if (videoModel && !isGenerationModelAvailable(videoModel)) {
    throw new CreateVideoError(`${videoModel.name} isn't set up on this server. Pick another model.`, 400);
  }
  if (videoModel && !videoModel.aspectRatios.includes(parsed.data.format)) {
    const formats = new Intl.ListFormat("en", { type: "disjunction" }).format(
      VIDEO_FORMATS.filter((format) => videoModel.aspectRatios.includes(format)),
    );
    throw new CreateVideoError(`${videoModel.name} only films ${formats} video.`, 400);
  }

  /** The prompt goes to the model as typed: no look, no added lines, and one clip. */
  const direct = isDirectMode(resolved?.mode.id);
  // One clip runs a length the chosen model can film, so that is the length filmed and charged.
  if (direct && videoModel) length = clipDuration(length, videoModel.durations);

  const acceptsReferences = !resolved || modeAcceptsReferenceImages(resolved.mode);
  const requestedKeys = acceptsReferences
    ? [...new Set([...(parsed.data.referenceKeys ?? []), ...(parsed.data.referenceKey ? [parsed.data.referenceKey] : [])])]
    : [];

  const characterId = parsed.data.characterId || OFF_VOICE_ID;
  if (characterId !== OFF_VOICE_ID && !modeCanNarrate(parsed.data.mode)) {
    throw new CreateVideoError("This video keeps its own audio. Leave the character off.", 400);
  }
  if (composed && characterId === OFF_VOICE_ID) {
    throw new CreateVideoError("Pick a voice to read the script.", 400);
  }
  if (resolved?.mode.id === "shorts" && (characterId === OFF_VOICE_ID || characterId === STUDIO_VOICE_ID)) {
    throw new CreateVideoError("Pick a character to present this video.", 400);
  }
  if (resolved?.mode.id === "shorts" && requestedKeys.length > 1) {
    throw new CreateVideoError("Add one background picture at most.", 400);
  }
  let characterImageKey: string | null = null;
  if (characterId !== OFF_VOICE_ID && characterId !== STUDIO_VOICE_ID) {
    const character = await getPickableCharacter(userId, characterId);
    if (!character) throw new CreateVideoError("Pick a character that has a picture.", 400);
    characterImageKey = character.imageKey;
  }
  const canUseCharacterImage = Boolean(characterImageKey) && acceptsReferences && Boolean(videoModel?.referenceImages);
  const referenceKeys = canUseCharacterImage
    ? mergeCharacterImage(requestedKeys, characterImageKey, MAX_REFERENCE_IMAGES)
    : requestedKeys.slice(0, MAX_REFERENCE_IMAGES);
  if (referenceKeys.length > 0) {
    const invalid = referenceKeys.some((key) => !isOwnedUploadKey(userId, key) || !isImageKey(key));
    if (invalid) throw new CreateVideoError("Upload a reference picture.", 400);
  }

  const lyricsMode = resolved?.mode.id === "lyrics";
  const ownedPictures = (keys: readonly string[], message: string) => {
    const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))].slice(0, MAX_LYRICS_REFERENCES);
    if (unique.some((key) => !isOwnedUploadKey(userId, key) || !isImageKey(key))) {
      throw new CreateVideoError(message, 400);
    }
    return unique;
  };
  const direction = lyricsMode ? parsed.data.direction : "";
  const scene = lyricsMode ? parsed.data.scene : "";
  const directionKeys = lyricsMode
    ? ownedPictures(parsed.data.directionKeys, "Upload a shot reference picture.")
    : [];
  const sceneKeys = lyricsMode ? ownedPictures(parsed.data.sceneKeys, "Upload a scene picture.") : [];
  if ((referenceKeys.length > 0 || directionKeys.length > 0 || sceneKeys.length > 0) && !videoModel?.referenceImages) {
    throw new CreateVideoError("This model can't use a reference picture.", 400);
  }

  let songId: string | undefined;
  let brief: PromptBrief | undefined;
  let attachmentRoles: AttachmentAssignment[] | undefined;
  let cuts: SongCut[] | undefined;
  if (parsed.data.songId) {
    if (resolved?.mode.id !== "lyrics") throw new CreateVideoError("Only lyrics videos use a song take.", 400);
    const draft = await readSongDraft(userId, parsed.data.songId);
    const fits =
      draft &&
      songDraftFits(draft, {
        prompt,
        length,
        model: modelSlug,
        characterId: songCharacterId(characterId),
        hasSinger: referenceKeys.length > 0,
      });
    if (!fits) throw new CreateVideoError("The lyrics or settings changed. Make the song again.", 409);
    songId = draft.id;
  }

  if (lyricsMode && videoModel) {
    const durations = lyricsClipDurations(videoModel, referenceKeys.length > 0);
    const limit = durations.length > 0 ? Math.max(...durations) : length;
    const sent = parsed.data.cuts ?? [];
    if (sent.length > 0) {
      cuts = normalizeCuts(sent, length, limit);
    } else {
      const songBrief = readSongBrief(prompt);
      cuts = await planCuts({
        lyrics: songBrief.lyrics || prompt,
        style: songBrief.style,
        direction,
        scene,
        length,
        durations,
      });
    }
  }

  if (resolved?.mode.id === "prompt" && videoModel) {
    const durations = videoModel.durations;
    const sent = parsed.data.cuts ?? [];
    const context = {
      length,
      durations,
      referenceCount: referenceKeys.length,
    };
    const preset = presetById(parsed.data.presetId);
    const planned =
      sent.length > 0
        ? promptPlanFromOutput(
            {
              ...parsed.data.brief,
              attachmentRoles: parsed.data.attachmentRoles,
              cuts: sent,
            },
            context,
          )
        : await planPromptCuts({
            prompt,
            length,
            durations,
            format: parsed.data.format,
            referenceCount: referenceKeys.length,
            visualDirection: parsed.data.visualDirection,
            styleNote: preset && preset.id !== AUTO_PRESET_ID ? preset.promptFragment : "",
            clips: parsed.data.clips,
          });
    brief = planned.brief;
    attachmentRoles = planned.attachmentRoles;
    cuts = planned.cuts;
  }

  try {
    const credits = videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: resolved?.mode.id,
      media: composed ? media : undefined,
      pictures: stillPictureCount({ prompt, verbatim, media, length }),
      tier: resolved?.tier,
      modelId: videoModel?.id,
      modelSlug: videoModel?.slug ?? modelSlug,
      resolution,
      length,
      referenceCount: referenceKeys.length,
      songReady: Boolean(songId),
      cuts,
      clips: parsed.data.clips,
    });
    const job = await createQueuedVideoJob(userId, {
      prompt,
      format: parsed.data.format,
      length,
      model: modelSlug,
      mode: resolved?.mode.id,
      tool: tool?.slug,
      media: composed ? media : undefined,
      backgroundId,
      backgroundKey,
      verbatim,
      sourceUrl: sourceUrlFor(parsed.data.sourceUrl),
      tier: resolved?.tier,
      resolution,
      mediaKey: resolved && modeNeedsUpload(resolved.mode) ? mediaKey : undefined,
      imageKey: resolved && modeNeedsUpload(resolved.mode) ? mediaKey : undefined,
      referenceKeys: referenceKeys.length > 0 ? referenceKeys : undefined,
      showText: direct ? undefined : parsed.data.showText,
      presetId: direct ? undefined : parsed.data.presetId,
      visualDirection: direct ? undefined : parsed.data.visualDirection,
      characterId,
      direction,
      scene,
      directionKeys,
      sceneKeys,
      songId,
      cuts,
      brief,
      attachmentRoles,
      vo: parsed.data.vo,
      clips: parsed.data.clips,
      creditsHeld: credits,
    });
    void import("@/lib/video/worker")
      .then(({ startVideoJob }) => startVideoJob(userId, job.id))
      .catch((error) => {
        console.error("Video stopped", error);
      });
    return { jobId: job.id, credits };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw error;
    console.error("Could not start the video", error);
    throw new CreateVideoError("Couldn't start the video. Try again.", 500);
  }
};

/**
 * Queues one quick edit. The length comes from the upload itself, so the form does not ask for it.
 * The upload was already checked to be this person's video.
 */
const queueEdit = async (
  userId: string,
  input: { key: string; op: EditOp | undefined; opValue: string | undefined; tool: string | undefined },
) => {
  if (!input.op) throw new CreateVideoError("Pick what to change.", 400);
  if (input.opValue !== undefined && !isEditValue(input.op, input.opValue)) {
    throw new CreateVideoError("That setting isn't available for this edit.", 400);
  }
  const op = input.op;
  const value = editValueFor(op, input.opValue);
  let seconds: number;
  let format: VideoFormat;
  try {
    const probe = await probeUpload(userId, input.key);
    if (!probe.hasVideo || !(probe.durationSec > 0)) throw new Error("no picture");
    seconds = probe.durationSec * editLengthFactor(op, value);
    // The result keeps the upload's shape, except that a quarter turn swaps its sides.
    const turned = op === "rotate" && value !== "180";
    format =
      editFormat(op, value) ??
      closestFormat(turned ? probe.height : probe.width, turned ? probe.width : probe.height);
  } catch (error) {
    console.error("Could not read the upload for a quick edit", error);
    throw new CreateVideoError("We couldn't read that video. Upload an MP4 or WebM and try again.", 400);
  }
  if (seconds > MAX_EDIT_SECONDS) {
    throw new CreateVideoError(`The result would run ${Math.round(seconds)} seconds. Keep it under ${MAX_EDIT_SECONDS}.`, 400);
  }
  try {
    const credits = videoJobCredits({ demo: false, mode: "edit", length: seconds });
    const job = await createQueuedVideoJob(userId, {
      prompt: describeEdit(op, value),
      format,
      length: Math.max(MIN_VIDEO_LENGTH, Math.round(seconds)),
      model: EDIT_MODEL,
      mode: "edit",
      tool: input.tool,
      tier: "pro",
      mediaKey: input.key,
      op,
      opValue: value,
      showText: false,
      creditsHeld: credits,
    });
    void import("@/lib/video/worker")
      .then(({ startVideoJob }) => startVideoJob(userId, job.id))
      .catch((error) => {
        console.error("Quick edit stopped", error);
      });
    return { jobId: job.id, credits };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw error;
    console.error("Could not start the quick edit", error);
    throw new CreateVideoError("Couldn't start the edit. Try again.", 500);
  }
};

/** Queues a captioning job. The upload was already checked to be this person's video. */
const queueCaptions = async (userId: string, input: { key: string; tool: string | undefined }) => {
  let seconds: number;
  let format: VideoFormat;
  try {
    const probe = await probeUpload(userId, input.key);
    if (!probe.hasVideo || !(probe.durationSec > 0)) throw new Error("no picture");
    if (!probe.hasAudio) throw new CreateVideoError("That video has no sound, so there is nothing to caption.", 400);
    seconds = probe.durationSec;
    format = closestFormat(probe.width, probe.height);
  } catch (error) {
    if (error instanceof CreateVideoError) throw error;
    console.error("Could not read the upload for captions", error);
    throw new CreateVideoError("We couldn't read that video. Upload an MP4 or WebM and try again.", 400);
  }
  if (seconds > MAX_CAPTION_SECONDS) {
    throw new CreateVideoError(`That video is longer than ${MAX_CAPTION_SECONDS / 60} minutes. Trim it first.`, 400);
  }
  try {
    const credits = videoJobCredits({ demo: !hasOpenRouterKey(), mode: "captions", length: seconds });
    const job = await createQueuedVideoJob(userId, {
      prompt: "Add captions to this video.",
      format,
      length: Math.max(MIN_VIDEO_LENGTH, Math.round(seconds)),
      model: CAPTIONS_MODEL,
      mode: "captions",
      tool: input.tool,
      tier: "pro",
      mediaKey: input.key,
      showText: true,
      creditsHeld: credits,
    });
    void import("@/lib/video/worker")
      .then(({ startVideoJob }) => startVideoJob(userId, job.id))
      .catch((error) => {
        console.error("Captions stopped", error);
      });
    return { jobId: job.id, credits };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw error;
    console.error("Could not start the captions", error);
    throw new CreateVideoError("Couldn't start the captions. Try again.", 500);
  }
};

/** The longest result a quick edit may produce. Looping a clip is what gets close to it. */
const MAX_EDIT_SECONDS = 600;

/** Only a plain web address is kept. Anything else pasted into the field is dropped, not stored. */
const sourceUrlFor = (raw: string | undefined) => {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const missingUpload = (kind: "image" | "audio" | "video" | "media", userId: string, key?: string) => {
  if (!key || !isOwnedUploadKey(userId, key)) {
    if (kind === "image") return "Upload a starting picture.";
    if (kind === "audio") return "Upload a song.";
    if (kind === "video") return "Upload a video.";
    return "Upload an audio or video file.";
  }
  if (kind === "image" && !isImageKey(key)) return "Upload a starting picture.";
  if (kind === "audio" && !isAudioKey(key)) return "Upload a song.";
  if (kind === "video" && !isVideoKey(key)) return "Upload a video.";
  if (kind === "media" && !isMediaKey(key)) return "Upload an audio or video file.";
  return null;
};
