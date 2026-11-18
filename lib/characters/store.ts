import "server-only";
import { db } from "@/lib/db";
import { addInstantVoice, deleteInstantVoice, saveDesignedVoice } from "@/lib/production/adapters/elevenlabs";
import { isImageKey, isOwnedUploadKey, uploadFileUrl } from "@/lib/storage/upload-key";
import { audioSampleType, extensionForSample } from "@/lib/voice/constants";
import { MAX_SAVED_CHARACTERS } from "./constants";
import { parseCharacterFields, recordedSamplesProblem, type CharacterFields } from "./input";
import {
  isMediaKind,
  isMediaLabel,
  MAX_DESCRIPTION,
  MAX_PERSONALITY,
  MAX_SPEAKING_STYLE,
  type CharacterLookItem,
  type CharacterMediaItem,
} from "./media";
import type { CharacterSummary } from "./types";

export interface ProfileInput {
  description?: unknown;
  personality?: unknown;
  speakingStyle?: unknown;
  /** The person shown is the owner, or agreed to be shown. true or "yes" records it now; false clears it. */
  pictureConsent?: unknown;
}

const textOrNull = (value: unknown, max: number) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
};

/** Only the fields that were sent are written. */
export const profileData = (input: ProfileInput) => {
  const data: { description?: string | null; personality?: string | null; speakingStyle?: string | null; consentAt?: Date | null } = {};
  const description = textOrNull(input.description, MAX_DESCRIPTION);
  if (description !== undefined) data.description = description;
  const personality = textOrNull(input.personality, MAX_PERSONALITY);
  if (personality !== undefined) data.personality = personality;
  const speakingStyle = textOrNull(input.speakingStyle, MAX_SPEAKING_STYLE);
  if (speakingStyle !== undefined) data.speakingStyle = speakingStyle;
  if (input.pictureConsent === true || input.pictureConsent === "yes") data.consentAt = new Date();
  if (input.pictureConsent === false) data.consentAt = null;
  return data;
};

export type CharacterView = CharacterSummary;

type MediaRow = {
  id: string;
  kind: string;
  key: string;
  label: string;
  lookId: string | null;
  caption: string | null;
  durationSec: number | null;
  sourceMediaId: string | null;
  position: number;
};

type LookRow = { id: string; name: string; wardrobe: string | null; position: number };

type CharacterRow = {
  id: string;
  name: string;
  imageKey: string | null;
  imagePrompt: string | null;
  providerVoiceId: string | null;
  voiceSource: string | null;
  voiceDescription: string | null;
  sampleCount: number;
  description: string | null;
  personality: string | null;
  speakingStyle: string | null;
  consentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  media?: MediaRow[];
  looks?: LookRow[];
};

/** Media and looks ride along with every character read. */
export const WITH_MEDIA = {
  media: { orderBy: { position: "asc" as const } },
  looks: { orderBy: { position: "asc" as const } },
};

export const mediaView = (row: MediaRow): CharacterMediaItem => ({
  id: row.id,
  kind: isMediaKind(row.kind) ? row.kind : "image",
  key: row.key,
  url: uploadFileUrl(row.key),
  label: isMediaLabel(row.label) ? row.label : "other",
  lookId: row.lookId,
  caption: row.caption,
  durationSec: row.durationSec,
  sourceMediaId: row.sourceMediaId,
  position: row.position,
});

export const lookView = (row: LookRow): CharacterLookItem => ({
  id: row.id,
  name: row.name,
  wardrobe: row.wardrobe,
  position: row.position,
});

const toView = (row: CharacterRow): CharacterView => ({
  id: row.id,
  name: row.name,
  imageKey: row.imageKey,
  imageUrl: row.imageKey ? uploadFileUrl(row.imageKey) : null,
  imagePrompt: row.imagePrompt,
  hasImage: Boolean(row.imageKey),
  hasVoice: Boolean(row.providerVoiceId),
  voiceSource: row.voiceSource,
  voiceDescription: row.voiceDescription,
  sampleCount: row.sampleCount,
  description: row.description,
  personality: row.personality,
  speakingStyle: row.speakingStyle,
  consented: Boolean(row.consentAt),
  media: (row.media ?? []).map(mediaView),
  looks: (row.looks ?? []).map(lookView),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const ownedImageKey = (userId: string, imageKey: string) => {
  if (!isOwnedUploadKey(userId, imageKey) || !isImageKey(imageKey)) {
    throw new Error("Use a picture from your own library.");
  }
  return imageKey;
};

const recordedFiles = (files: { bytes: Uint8Array; type: string; name: string }[]) => {
  const problem = recordedSamplesProblem(
    files.map((file) => ({ size: file.bytes.byteLength, type: file.type, name: file.name })),
  );
  if (problem) throw new Error(problem);
  return files.map((file, index) => {
    const type = audioSampleType(file.type, file.name);
    return { bytes: file.bytes, type, filename: `line-${index + 1}.${extensionForSample(type)}` };
  });
};

const createProviderVoice = async (
  name: string,
  fields: CharacterFields,
  files: { bytes: Uint8Array; type: string; name: string }[],
) => {
  if (fields.voiceMode === "recorded") {
    const samples = recordedFiles(files);
    const providerVoiceId = await addInstantVoice({
      name: `PoliVid ${name} ${crypto.randomUUID().slice(0, 8)}`,
      description: "Recorded in PoliVid with the uploader confirming permission to clone and use the voice.",
      files: samples,
    });
    return { providerVoiceId, voiceSource: "recorded", voiceDescription: null, sampleCount: samples.length };
  }
  if (fields.voiceMode === "designed") {
    const providerVoiceId = await saveDesignedVoice({
      name: `PoliVid ${name} ${crypto.randomUUID().slice(0, 8)}`,
      description: fields.voiceDescription,
      generatedVoiceId: fields.generatedVoiceId,
    });
    return {
      providerVoiceId,
      voiceSource: "designed",
      voiceDescription: fields.voiceDescription,
      sampleCount: 0,
    };
  }
  return { providerVoiceId: null, voiceSource: null, voiceDescription: null, sampleCount: 0 };
};

export const listCharacters = async (userId: string) => {
  const rows = await db.character.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: WITH_MEDIA,
  });
  return rows.map(toView);
};

export const getCharacter = async (userId: string, id: string) =>
  db.character.findFirst({ where: { id, userId }, include: WITH_MEDIA });

export const getCharacterView = async (userId: string, id: string) => {
  const row = await getCharacter(userId, id);
  return row ? toView(row) : null;
};

export const getPickableCharacter = async (userId: string, id: string) => {
  const row = await getCharacter(userId, id);
  if (!row) return null;
  if (!row.imageKey) return null;
  return row;
};

export const createCharacter = async (
  userId: string,
  input: {
    name?: unknown;
    imageKey?: unknown;
    imagePrompt?: unknown;
    voiceMode?: unknown;
    generatedVoiceId?: unknown;
    voiceDescription?: unknown;
    files?: { bytes: Uint8Array; type: string; name: string }[];
  } & ProfileInput,
) => {
  const fields = parseCharacterFields({ ...input, requireImage: true });
  const imageKey = ownedImageKey(userId, fields.imageKey);
  const count = await db.character.count({ where: { userId } });
  if (count >= MAX_SAVED_CHARACTERS) {
    throw new Error(`You can keep ${MAX_SAVED_CHARACTERS} characters. Delete one to add another.`);
  }
  const voice = await createProviderVoice(fields.name, fields, input.files ?? []);
  try {
    const row = await db.character.create({
      data: {
        userId,
        name: fields.name,
        imageKey,
        imagePrompt: fields.imagePrompt || null,
        providerVoiceId: voice.providerVoiceId,
        voiceSource: voice.voiceSource,
        voiceDescription: voice.voiceDescription,
        sampleCount: voice.sampleCount,
        ...profileData(input),
        media: { create: { kind: "image", key: imageKey, label: "face", position: 0 } },
      },
      include: WITH_MEDIA,
    });
    return toView(row);
  } catch (error) {
    if (voice.providerVoiceId) await deleteInstantVoice(voice.providerVoiceId).catch(() => undefined);
    throw error;
  }
};

export const updateCharacter = async (
  userId: string,
  id: string,
  input: {
    name?: unknown;
    imageKey?: unknown;
    imagePrompt?: unknown;
    voiceMode?: unknown;
    generatedVoiceId?: unknown;
    voiceDescription?: unknown;
    files?: { bytes: Uint8Array; type: string; name: string }[];
    keepVoice?: boolean;
  } & ProfileInput,
) => {
  const existing = await getCharacter(userId, id);
  if (!existing) return null;
  const fields = parseCharacterFields({
    name: input.name ?? existing.name,
    imageKey: input.imageKey ?? existing.imageKey ?? "",
    imagePrompt: input.imagePrompt ?? existing.imagePrompt ?? "",
    voiceMode: input.keepVoice ? "none" : input.voiceMode,
    generatedVoiceId: input.generatedVoiceId,
    voiceDescription: input.voiceDescription ?? existing.voiceDescription ?? "",
    requireImage: true,
  });
  const imageKey = ownedImageKey(userId, fields.imageKey);
  let voice = {
    providerVoiceId: existing.providerVoiceId,
    voiceSource: existing.voiceSource,
    voiceDescription: existing.voiceDescription,
    sampleCount: existing.sampleCount,
  };
  let createdVoiceId: string | null = null;
  if (!input.keepVoice) {
    voice = await createProviderVoice(fields.name, fields, input.files ?? []);
    createdVoiceId = voice.providerVoiceId;
  }
  try {
    const row = await db.character.update({
      where: { id: existing.id },
      data: {
        name: fields.name,
        imageKey,
        imagePrompt: fields.imagePrompt || null,
        providerVoiceId: voice.providerVoiceId,
        voiceSource: voice.voiceSource,
        voiceDescription: voice.voiceDescription,
        sampleCount: voice.sampleCount,
        ...profileData(input),
      },
      include: WITH_MEDIA,
    });
    // A new main picture joins the media library, so it is never lost from the character.
    if (imageKey !== existing.imageKey && !row.media.some((item) => item.key === imageKey)) {
      await db.characterMedia.create({ data: { characterId: row.id, kind: "image", key: imageKey, label: "face", position: -1 } });
    }
    if (!input.keepVoice && existing.providerVoiceId && existing.providerVoiceId !== voice.providerVoiceId) {
      await releaseVoice(existing.providerVoiceId);
    }
    return (await getCharacterView(userId, row.id)) ?? toView(row);
  } catch (error) {
    if (createdVoiceId) await deleteInstantVoice(createdVoiceId).catch(() => undefined);
    throw error;
  }
};

export const deleteCharacter = async (userId: string, id: string) => {
  const row = await getCharacter(userId, id);
  if (!row) return false;
  await db.character.delete({ where: { id: row.id } });
  await releaseVoice(row.providerVoiceId);
  return true;
};

/**
 * Deletes a cloned voice from ElevenLabs once no character uses it any more. A character copied to
 * another account shares its voice, so replacing or deleting one copy must not break the other.
 * Call it after the character has stopped pointing at the voice.
 */
export const releaseVoice = async (voiceId: string | null | undefined) => {
  if (!voiceId) return;
  const stillUsed = await db.character.count({ where: { providerVoiceId: voiceId } });
  if (stillUsed > 0) return;
  await deleteInstantVoice(voiceId).catch((error) => {
    console.error("Could not delete the cloned voice", error);
  });
};
