import "server-only";
import { z } from "zod";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { isAudioKey, isImageKey, isMediaKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import { isGenerationModelAvailable } from "@/lib/video/available-models";
import { createQueuedVideoJob } from "@/lib/video/jobs";
import { generationModelById } from "@/lib/video/models";
import {
  defaultPromptForMode,
  modeAcceptsReferenceImages,
  modeNeedsUpload,
  resolveModeTier,
} from "@/lib/video/modes";
import { CreateVideoSchema } from "@/lib/video/create-schema";
import { MAX_LYRICS_REFERENCES, MAX_REFERENCE_IMAGES, VIDEO_FORMATS } from "@/lib/video/schema";
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

  const videoModel = resolved ? resolved.model : parsed.data.model ? generationModelById(parsed.data.model) : null;
  const modelSlug = resolved?.chatModel ?? videoModel?.slug;
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

  const acceptsReferences = !resolved || modeAcceptsReferenceImages(resolved.mode);
  const requestedKeys = acceptsReferences
    ? [...new Set([...(parsed.data.referenceKeys ?? []), ...(parsed.data.referenceKey ? [parsed.data.referenceKey] : [])])]
    : [];

  const characterId = parsed.data.characterId || OFF_VOICE_ID;
  if (characterId !== OFF_VOICE_ID && !modeCanNarrate(parsed.data.mode)) {
    throw new CreateVideoError("This video keeps its own audio. Leave the character off.", 400);
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
        length: parsed.data.length,
        model: modelSlug,
        characterId: songCharacterId(characterId),
        hasSinger: referenceKeys.length > 0,
      });
    if (!fits) throw new CreateVideoError("The lyrics or settings changed. Make the song again.", 409);
    songId = draft.id;
  }

  if (lyricsMode && videoModel) {
    const durations = lyricsClipDurations(videoModel, referenceKeys.length > 0);
    const limit = durations.length > 0 ? Math.max(...durations) : parsed.data.length;
    const sent = parsed.data.cuts ?? [];
    if (sent.length > 0) {
      cuts = normalizeCuts(sent, parsed.data.length, limit);
    } else {
      const songBrief = readSongBrief(prompt);
      cuts = await planCuts({
        lyrics: songBrief.lyrics || prompt,
        style: songBrief.style,
        direction,
        scene,
        length: parsed.data.length,
        durations,
      });
    }
  }

  if (resolved?.mode.id === "prompt" && videoModel) {
    const durations = videoModel.durations;
    const sent = parsed.data.cuts ?? [];
    const context = {
      length: parsed.data.length,
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
            length: parsed.data.length,
            durations,
            format: parsed.data.format,
            referenceCount: referenceKeys.length,
            visualDirection: parsed.data.visualDirection,
            styleNote: preset && preset.id !== AUTO_PRESET_ID ? preset.promptFragment : "",
          });
    brief = planned.brief;
    attachmentRoles = planned.attachmentRoles;
    cuts = planned.cuts;
  }

  try {
    const credits = videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: resolved?.mode.id,
      tier: resolved?.tier,
      modelId: videoModel?.id,
      modelSlug: videoModel?.slug ?? modelSlug,
      resolution: resolved?.resolution,
      length: parsed.data.length,
      referenceCount: referenceKeys.length,
      songReady: Boolean(songId),
      cuts,
    });
    const job = await createQueuedVideoJob(userId, {
      prompt,
      format: parsed.data.format,
      length: parsed.data.length,
      model: modelSlug,
      mode: resolved?.mode.id,
      tier: resolved?.tier,
      resolution: resolved?.resolution,
      mediaKey: resolved && modeNeedsUpload(resolved.mode) ? mediaKey : undefined,
      imageKey: resolved && modeNeedsUpload(resolved.mode) ? mediaKey : undefined,
      referenceKeys: referenceKeys.length > 0 ? referenceKeys : undefined,
      showText: parsed.data.showText,
      presetId: parsed.data.presetId,
      visualDirection: parsed.data.visualDirection,
      characterId,
      direction,
      scene,
      directionKeys,
      sceneKeys,
      songId,
      cuts,
      brief,
      attachmentRoles,
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
