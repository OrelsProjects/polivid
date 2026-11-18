import "server-only";
import { db } from "@/lib/db";
import { addInstantVoice, deleteInstantVoice } from "@/lib/production/adapters/elevenlabs";
import { audioSampleType, extensionForSample, MAX_SAMPLE_BYTES, MAX_VOICE_FILES, MIN_SAMPLE_BYTES } from "@/lib/voice/constants";
import { isImageKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import {
  isMediaLabel,
  MAX_CAPTION,
  MAX_CHARACTER_CLIPS,
  MAX_CHARACTER_IMAGES,
  MAX_CHARACTER_LOOKS,
  MAX_CLIP_SECONDS,
  MAX_LOOK_NAME,
  MAX_WARDROBE,
  type MediaLabel,
} from "./media";
import { getCharacterView, profileData, releaseVoice, type ProfileInput } from "./store";

/** Problems the person or the agent can fix. Routes turn these into 400s. */
export class CharacterLibraryError extends Error {}

const owned = async (userId: string, characterId: string) => {
  const row = await db.character.findFirst({ where: { id: characterId, userId }, select: { id: true, imageKey: true } });
  if (!row) throw new CharacterLibraryError("That character was not found.");
  return row;
};

const lookOf = async (characterId: string, lookId: unknown) => {
  if (lookId === null || lookId === "" || lookId === undefined) return null;
  if (typeof lookId !== "string") throw new CharacterLibraryError("lookId must be a look id.");
  const look = await db.characterLook.findFirst({ where: { id: lookId, characterId }, select: { id: true } });
  if (!look) throw new CharacterLibraryError("That look isn't on this character.");
  return look.id;
};

const captionOf = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_CAPTION) || null : undefined);

export interface AddMediaInput {
  key: string;
  label?: unknown;
  lookId?: unknown;
  caption?: unknown;
  durationSec?: unknown;
  sourceMediaId?: unknown;
}

export const addCharacterMedia = async (userId: string, characterId: string, items: AddMediaInput[]) => {
  await owned(userId, characterId);
  if (items.length === 0) throw new CharacterLibraryError("Add at least one picture or clip.");
  const existing = await db.characterMedia.findMany({ where: { characterId }, select: { kind: true, key: true, position: true } });
  let images = existing.filter((item) => item.kind === "image").length;
  let clips = existing.filter((item) => item.kind === "video").length;
  let position = existing.reduce((max, item) => Math.max(max, item.position), 0);
  const rows: {
    characterId: string;
    kind: string;
    key: string;
    label: string;
    lookId: string | null;
    caption: string | null;
    durationSec: number | null;
    sourceMediaId: string | null;
    position: number;
  }[] = [];
  for (const item of items) {
    const key = typeof item.key === "string" ? item.key.trim() : "";
    if (!key || !isOwnedUploadKey(userId, key)) throw new CharacterLibraryError("Use pictures and clips from your own uploads.");
    if (existing.some((entry) => entry.key === key) || rows.some((entry) => entry.key === key)) continue;
    const kind = isImageKey(key) ? "image" : isVideoKey(key) ? "video" : null;
    if (!kind) throw new CharacterLibraryError("A character can hold pictures (JPEG, PNG, WebP) and video clips (MP4, WebM, MOV).");
    if (kind === "image" && ++images > MAX_CHARACTER_IMAGES) {
      throw new CharacterLibraryError(`A character holds up to ${MAX_CHARACTER_IMAGES} pictures. Remove some first.`);
    }
    if (kind === "video" && ++clips > MAX_CHARACTER_CLIPS) {
      throw new CharacterLibraryError(`A character holds up to ${MAX_CHARACTER_CLIPS} clips. Remove one first.`);
    }
    const durationSec = typeof item.durationSec === "number" && Number.isFinite(item.durationSec) ? item.durationSec : null;
    if (kind === "video" && durationSec !== null && durationSec > MAX_CLIP_SECONDS + 0.5) {
      throw new CharacterLibraryError(`Keep character clips to ${MAX_CLIP_SECONDS} seconds or less.`);
    }
    const sourceMediaId =
      typeof item.sourceMediaId === "string" && item.sourceMediaId
        ? ((await db.characterMedia.findFirst({ where: { id: item.sourceMediaId, characterId }, select: { id: true } }))?.id ?? null)
        : null;
    rows.push({
      characterId,
      kind,
      key,
      label: isMediaLabel(item.label) ? item.label : "other",
      lookId: await lookOf(characterId, item.lookId),
      caption: captionOf(item.caption) ?? null,
      durationSec: kind === "video" ? durationSec : null,
      sourceMediaId,
      position: ++position,
    });
  }
  if (rows.length > 0) await db.characterMedia.createMany({ data: rows });
  return getCharacterView(userId, characterId);
};

export const updateCharacterMedia = async (
  userId: string,
  characterId: string,
  mediaId: string,
  patch: { label?: unknown; lookId?: unknown; caption?: unknown; main?: unknown },
) => {
  await owned(userId, characterId);
  const media = await db.characterMedia.findFirst({ where: { id: mediaId, characterId } });
  if (!media) throw new CharacterLibraryError("That picture or clip isn't on this character.");
  const data: { label?: MediaLabel; lookId?: string | null; caption?: string | null } = {};
  if (patch.label !== undefined) {
    if (!isMediaLabel(patch.label)) throw new CharacterLibraryError("Unknown label.");
    data.label = patch.label;
  }
  if (patch.lookId !== undefined) data.lookId = await lookOf(characterId, patch.lookId);
  const caption = captionOf(patch.caption);
  if (caption !== undefined) data.caption = caption;
  if (Object.keys(data).length > 0) await db.characterMedia.update({ where: { id: media.id }, data });
  if (patch.main === true) {
    if (media.kind !== "image") throw new CharacterLibraryError("Only a picture can be the main picture.");
    await db.character.update({ where: { id: characterId }, data: { imageKey: media.key } });
  }
  return getCharacterView(userId, characterId);
};

export const removeCharacterMedia = async (userId: string, characterId: string, mediaId: string) => {
  const character = await owned(userId, characterId);
  const media = await db.characterMedia.findFirst({ where: { id: mediaId, characterId } });
  if (!media) throw new CharacterLibraryError("That picture or clip isn't on this character.");
  if (media.key === character.imageKey) {
    const next = await db.characterMedia.findFirst({
      where: { characterId, kind: "image", id: { not: media.id } },
      orderBy: { position: "asc" },
    });
    if (!next) throw new CharacterLibraryError("A character needs at least one picture. Add another before removing this one.");
    await db.character.update({ where: { id: characterId }, data: { imageKey: next.key } });
  }
  await db.characterMedia.delete({ where: { id: media.id } });
  return getCharacterView(userId, characterId);
};

export const updateCharacterProfile = async (userId: string, characterId: string, input: ProfileInput & { name?: unknown }) => {
  await owned(userId, characterId);
  const data = profileData(input);
  if (typeof input.name === "string" && input.name.trim().length >= 2) Object.assign(data, { name: input.name.trim().slice(0, 40) });
  if (Object.keys(data).length > 0) await db.character.update({ where: { id: characterId }, data });
  return getCharacterView(userId, characterId);
};

const lookName = (value: unknown) => {
  const name = typeof value === "string" ? value.trim().slice(0, MAX_LOOK_NAME) : "";
  if (name.length < 2) throw new CharacterLibraryError("Give the look a name, like Office or Gym.");
  return name;
};

const wardrobeOf = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_WARDROBE) || null : undefined);

export const addCharacterLook = async (userId: string, characterId: string, input: { name?: unknown; wardrobe?: unknown }) => {
  await owned(userId, characterId);
  const count = await db.characterLook.count({ where: { characterId } });
  if (count >= MAX_CHARACTER_LOOKS) throw new CharacterLibraryError(`A character holds up to ${MAX_CHARACTER_LOOKS} looks.`);
  const look = await db.characterLook.create({
    data: { characterId, name: lookName(input.name), wardrobe: wardrobeOf(input.wardrobe) ?? null, position: count },
  });
  return { lookId: look.id, character: await getCharacterView(userId, characterId) };
};

export const updateCharacterLook = async (
  userId: string,
  characterId: string,
  lookId: string,
  input: { name?: unknown; wardrobe?: unknown },
) => {
  await owned(userId, characterId);
  const look = await db.characterLook.findFirst({ where: { id: lookId, characterId } });
  if (!look) throw new CharacterLibraryError("That look isn't on this character.");
  const data: { name?: string; wardrobe?: string | null } = {};
  if (input.name !== undefined) data.name = lookName(input.name);
  const wardrobe = wardrobeOf(input.wardrobe);
  if (wardrobe !== undefined) data.wardrobe = wardrobe;
  await db.characterLook.update({ where: { id: look.id }, data });
  return getCharacterView(userId, characterId);
};

/** Pictures in the look stay on the character with no look. */
export const removeCharacterLook = async (userId: string, characterId: string, lookId: string) => {
  await owned(userId, characterId);
  const { count } = await db.characterLook.deleteMany({ where: { id: lookId, characterId } });
  if (count === 0) throw new CharacterLibraryError("That look isn't on this character.");
  return getCharacterView(userId, characterId);
};

const MAX_CLIP_VOICE_FILES = MAX_VOICE_FILES;

/**
 * Builds the character's voice from audio taken out of their clips (the browser extracts it).
 * The caller requires confirmation that the uploader has permission to clone and use the voice.
 */
export const voiceFromClipAudio = async (
  userId: string,
  characterId: string,
  files: { bytes: Uint8Array; type: string; name: string }[],
) => {
  const character = await db.character.findFirst({ where: { id: characterId, userId } });
  if (!character) throw new CharacterLibraryError("That character was not found.");
  if (files.length === 0 || files.length > MAX_CLIP_VOICE_FILES) {
    throw new CharacterLibraryError(`Send between 1 and ${MAX_CLIP_VOICE_FILES} clips' audio.`);
  }
  const samples = files.map((file, index) => {
    const type = audioSampleType(file.type, file.name);
    if (!type) throw new CharacterLibraryError("That isn't audio the voice service can read.");
    if (file.bytes.byteLength < MIN_SAMPLE_BYTES) throw new CharacterLibraryError("That clip has too little speech. Use a clip where they talk.");
    if (file.bytes.byteLength > MAX_SAMPLE_BYTES) throw new CharacterLibraryError("That clip's audio is too long.");
    return { bytes: file.bytes, type, filename: `clip-${index + 1}.${extensionForSample(type)}` };
  });
  const providerVoiceId = await addInstantVoice({
    name: `PoliVid ${character.name} ${crypto.randomUUID().slice(0, 8)}`,
    description: "Created from uploaded recordings with the uploader confirming permission to clone and use the voice.",
    files: samples,
  });
  try {
    const { count } = await db.character.updateMany({
      where: { id: character.id, userId, providerVoiceId: character.providerVoiceId },
      data: { providerVoiceId, voiceSource: "recorded", voiceDescription: null, sampleCount: samples.length },
    });
    if (count !== 1) throw new CharacterLibraryError("This character changed while the voice was being created. Reload it and try again.");
  } catch (error) {
    await deleteInstantVoice(providerVoiceId).catch(() => undefined);
    throw error;
  }
  if (character.providerVoiceId && character.providerVoiceId !== providerVoiceId) {
    await releaseVoice(character.providerVoiceId);
  }
  return getCharacterView(userId, characterId);
};
