import "server-only";
import { z } from "zod";
import { MAX_CHARACTER_NAME, MAX_VOICE_DESCRIPTION, MIN_VOICE_DESCRIPTION } from "@/lib/characters/constants";
import { generateCharacterImage } from "@/lib/characters/generate-image";
import { addCharacterMedia, CharacterLibraryError, removeCharacterMedia, updateCharacterMedia, updateCharacterProfile } from "@/lib/characters/library";
import { MAX_DESCRIPTION, MAX_PERSONALITY, MAX_SPEAKING_STYLE, MEDIA_LABELS } from "@/lib/characters/media";
import { spendCharacterCredit } from "@/lib/characters/spend";
import { createCharacter, deleteCharacter, getCharacterView, listCharacters } from "@/lib/characters/store";
import type { CharacterSummary } from "@/lib/characters/types";
import { publicAppUrl, signAssetToken } from "@/lib/editor/asset-token";
import { designVoicePreviews } from "@/lib/production/adapters/elevenlabs";
import { getUpload } from "@/lib/storage/s3";
import { isAudioKey, isImageKey, isOwnedUploadKey } from "@/lib/storage/upload-key";
import { audioSampleType, DESIGN_PREVIEW_LINE, MAX_SAMPLE_BYTES, SAMPLE_PROMPTS } from "@/lib/voice/constants";
import { PartnerError } from "./http";

/** How long a character picture link works. */
const PICTURE_LINK_MS = 24 * 60 * 60 * 1000;

const pictureUrl = (userId: string, key: string | null) =>
  key ? `${publicAppUrl()}/api/editor/assets/${encodeURIComponent(signAssetToken(userId, { type: "upload", key }, PICTURE_LINK_MS))}` : null;

/** A character as a partner sees it: who they are, their picture, and whether they can speak. */
const partnerCharacter = (userId: string, character: CharacterSummary) => ({
  id: character.id,
  name: character.name,
  pictureUrl: pictureUrl(userId, character.imageKey),
  /**
   * Every picture of them. A UGC ad uses up to four, best angles first (the main one, then one per
   * label); a talking avatar uses the main one only.
   */
  pictures: character.media
    .filter((item) => item.kind === "image")
    .map((item) => ({ id: item.id, label: item.label, main: item.key === character.imageKey, url: pictureUrl(userId, item.key) })),
  hasVoice: character.hasVoice,
  voice: character.voiceSource,
  consented: character.consented,
  description: character.description,
  looks: character.looks.map((look) => ({ id: look.id, name: look.name })),
  createdAt: character.createdAt,
});

export const listPartnerCharacters = async (userId: string) =>
  (await listCharacters(userId)).map((character) => partnerCharacter(userId, character));

export const getPartnerCharacter = async (userId: string, id: string) => {
  const character = await getCharacterView(userId, id);
  if (!character) throw new PartnerError("not_found", "That character doesn't exist.");
  return partnerCharacter(userId, character);
};

/** The lines a person reads aloud, in order, to give a character their own voice. */
export const voicePrompts = () => SAMPLE_PROMPTS.map((prompt) => ({ id: prompt.id, label: prompt.label, text: prompt.text, minSeconds: prompt.minSeconds }));

const VoiceSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("none") }),
  z.strictObject({
    mode: z.literal("designed"),
    /** From POST /characters/voice-previews. */
    generatedVoiceId: z.string().trim().min(1),
    description: z.string().trim().min(MIN_VOICE_DESCRIPTION).max(MAX_VOICE_DESCRIPTION),
  }),
  z.strictObject({
    mode: z.literal("recorded"),
    /** Uploaded recordings of the voice prompts, one per prompt, in order. */
    sampleKeys: z.array(z.string().trim().min(1)).length(SAMPLE_PROMPTS.length),
    /** The person confirmed this is their voice, or they have permission to clone it. */
    consent: z.literal(true),
  }),
]);

export const PartnerCharacterSchema = z.strictObject({
  name: z.string().trim().min(2).max(MAX_CHARACTER_NAME),
  /** An uploaded picture, or one from POST /characters/portrait. */
  photoKey: z.string().trim().min(1),
  /** The person confirmed they are the one shown, or have permission to use the picture. */
  pictureConsent: z.literal(true),
  voice: VoiceSchema.default({ mode: "none" }),
  description: z.string().trim().max(MAX_DESCRIPTION).optional(),
  personality: z.string().trim().max(MAX_PERSONALITY).optional(),
  speakingStyle: z.string().trim().max(MAX_SPEAKING_STYLE).optional(),
});

const invalid = (error: z.ZodError) => {
  const issue = error.issues[0];
  const path = issue?.path.join(".") ?? "";
  if (path === "pictureConsent") return new PartnerError("invalid", "Confirm the person agreed to appear before saving the character.");
  if (path === "voice.consent") return new PartnerError("invalid", "Confirm the person agreed to have their voice cloned.");
  if (path === "voice.sampleKeys") return new PartnerError("invalid", `Send one recording for each of the ${SAMPLE_PROMPTS.length} voice prompts.`);
  return new PartnerError("invalid", issue ? `${path || "body"}: ${issue.message}` : "That character isn't valid.");
};

/** The recordings for a recorded voice, read back from the person's own uploads. */
const recordingFiles = async (userId: string, keys: readonly string[]) =>
  Promise.all(
    keys.map(async (key, index) => {
      // A browser records WebM (or MP4 in Safari), which is stored with the clips, so those count too.
      const recording = isAudioKey(key) || /\.(webm|mp4)$/i.test(key);
      if (!isOwnedUploadKey(userId, key) || !recording) throw new PartnerError("invalid", `Recording ${index + 1} isn't one of this person's audio uploads.`);
      const file = await getUpload(key);
      if (file.bytes.byteLength > MAX_SAMPLE_BYTES) throw new PartnerError("invalid", `Recording ${index + 1} is too long. Keep each under thirty seconds.`);
      const name = key.slice(key.lastIndexOf("/") + 1);
      if (!audioSampleType(file.contentType, name)) throw new PartnerError("invalid", `Recording ${index + 1} isn't audio.`);
      return { bytes: file.bytes, type: file.contentType, name };
    }),
  );

/**
 * Saves a character from a picture and a voice: none, one designed from a description, or the
 * person's own, cloned from their recordings. Both consents are required, as on the Characters page.
 */
export const createPartnerCharacter = async (userId: string, raw: unknown) => {
  const parsed = PartnerCharacterSchema.safeParse(raw);
  if (!parsed.success) throw invalid(parsed.error);
  const { voice, photoKey, ...profile } = parsed.data;
  if (!isOwnedUploadKey(userId, photoKey)) throw new PartnerError("invalid", "The photo isn't one of this person's uploads.");
  const files = voice.mode === "recorded" ? await recordingFiles(userId, voice.sampleKeys) : [];
  try {
    const character = await createCharacter(userId, {
      ...profile,
      imageKey: photoKey,
      voiceMode: voice.mode,
      generatedVoiceId: voice.mode === "designed" ? voice.generatedVoiceId : "",
      voiceDescription: voice.mode === "designed" ? voice.description : "",
      files,
    });
    return partnerCharacter(userId, character);
  } catch (error) {
    if (error instanceof PartnerError) throw error;
    throw new PartnerError("invalid", error instanceof Error ? error.message : "Couldn't save that character.");
  }
};

const UpdateSchema = z.strictObject({
  name: z.string().trim().min(2).max(MAX_CHARACTER_NAME).optional(),
  description: z.string().trim().max(MAX_DESCRIPTION).optional(),
  personality: z.string().trim().max(MAX_PERSONALITY).optional(),
  speakingStyle: z.string().trim().max(MAX_SPEAKING_STYLE).optional(),
});

export const updatePartnerCharacter = async (userId: string, id: string, raw: unknown) => {
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) throw invalid(parsed.error);
  const character = await updateCharacterProfile(userId, id, parsed.data).catch(() => null);
  if (!character) throw new PartnerError("not_found", "That character doesn't exist.");
  return partnerCharacter(userId, character);
};

export const deletePartnerCharacter = async (userId: string, id: string) => {
  const removed = await deleteCharacter(userId, id);
  if (!removed) throw new PartnerError("not_found", "That character doesn't exist.");
  return { id, deleted: true };
};

const DescriptionSchema = z.strictObject({ description: z.string().trim().min(MIN_VOICE_DESCRIPTION).max(MAX_VOICE_DESCRIPTION) });

/**
 * Three voices designed from a description, to listen to and pick from. Costs one credit, given back
 * if the voices don't come.
 */
export const designPartnerVoices = async (userId: string, raw: unknown) => {
  const parsed = DescriptionSchema.safeParse(raw);
  if (!parsed.success) throw new PartnerError("invalid", `Describe the voice in at least ${MIN_VOICE_DESCRIPTION} characters: age, accent, tone, pace.`);
  const spend = await spendCharacterCredit(userId, "character_voice");
  try {
    const previews = await designVoicePreviews(parsed.data.description, DESIGN_PREVIEW_LINE);
    return { previews: previews.map((preview) => ({ generatedVoiceId: preview.generatedVoiceId, audio: `data:audio/mpeg;base64,${preview.audioBase64}` })) };
  } catch (error) {
    await spend.refund().catch(() => undefined);
    throw error;
  }
};

const PortraitSchema = z.strictObject({ description: z.string().trim().min(10).max(600) });

/** A portrait drawn from a description, for a person with no photo to use. Costs one credit. */
export const drawPartnerPortrait = async (userId: string, raw: unknown) => {
  const parsed = PortraitSchema.safeParse(raw);
  if (!parsed.success) throw new PartnerError("invalid", "Describe the person in at least 10 characters.");
  const spend = await spendCharacterCredit(userId, "character_image");
  try {
    const picture = await generateCharacterImage(userId, parsed.data.description);
    return { photoKey: picture.imageKey, pictureUrl: pictureUrl(userId, picture.imageKey) };
  } catch (error) {
    await spend.refund().catch(() => undefined);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Pictures. More angles of the same person help a UGC ad keep their likeness.

const PictureLabel = z.enum(MEDIA_LABELS);

/** Pictures one call may add. */
export const MAX_PICTURES_PER_CALL = 10;

const AddPicturesSchema = z.strictObject({
  pictures: z
    .array(
      z.strictObject({
        /** From POST /uploads/import. */
        key: z.string().trim().min(1),
        /** What the picture shows. Faces and other angles do the most for the likeness. */
        label: PictureLabel.optional(),
      }),
    )
    .min(1)
    .max(MAX_PICTURES_PER_CALL),
});

const PictureUpdateSchema = z
  .strictObject({ label: PictureLabel.optional(), main: z.literal(true).optional() })
  .refine((value) => value.label !== undefined || value.main !== undefined, { message: "Send a label, or main: true." });

/** Library errors are things the caller can fix, except a missing character or picture. */
const libraryError = (error: unknown) => {
  if (error instanceof CharacterLibraryError) {
    return new PartnerError(/isn't on this character|was not found/.test(error.message) ? "not_found" : "invalid", error.message);
  }
  return error;
};

const viewAfter = async (userId: string, id: string, change: () => Promise<unknown>) => {
  try {
    await change();
  } catch (error) {
    throw libraryError(error);
  }
  return getPartnerCharacter(userId, id);
};

/** Adds more pictures of the same person, each from the user's own uploads. */
export const addPartnerPictures = async (userId: string, id: string, raw: unknown) => {
  const parsed = AddPicturesSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PartnerError("invalid", issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Those pictures aren't valid.");
  }
  parsed.data.pictures.forEach((picture, index) => {
    if (!isOwnedUploadKey(userId, picture.key) || !isImageKey(picture.key)) {
      throw new PartnerError("invalid", `Picture ${index + 1} isn't one of this person's picture uploads.`);
    }
  });
  return viewAfter(userId, id, () => addCharacterMedia(userId, id, parsed.data.pictures.map((picture) => ({ key: picture.key, label: picture.label }))));
};

/** Relabels a picture, or makes it the main one (the one a talking avatar speaks as). */
export const updatePartnerPicture = async (userId: string, id: string, pictureId: string, raw: unknown) => {
  const parsed = PictureUpdateSchema.safeParse(raw);
  if (!parsed.success) throw new PartnerError("invalid", parsed.error.issues[0]?.message ?? "Send a label, or main: true.");
  return viewAfter(userId, id, () => updateCharacterMedia(userId, id, pictureId, parsed.data));
};

/** Removes a picture. Removing the main one makes the next picture the main one. */
export const removePartnerPicture = async (userId: string, id: string, pictureId: string) =>
  viewAfter(userId, id, () => removeCharacterMedia(userId, id, pictureId));
