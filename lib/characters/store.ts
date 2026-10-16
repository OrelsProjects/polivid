import "server-only";
import { db } from "@/lib/db";
import { addInstantVoice, deleteInstantVoice, saveDesignedVoice } from "@/lib/production/adapters/elevenlabs";
import { isImageKey, isOwnedUploadKey, uploadFileUrl } from "@/lib/storage/upload-key";
import { audioSampleType, extensionForSample } from "@/lib/voice/constants";
import { MAX_SAVED_CHARACTERS } from "./constants";
import { parseCharacterFields, recordedSamplesProblem, type CharacterFields } from "./input";
import type { CharacterSummary } from "./types";

export type CharacterView = CharacterSummary;

type CharacterRow = {
  id: string;
  name: string;
  imageKey: string | null;
  imagePrompt: string | null;
  providerVoiceId: string | null;
  voiceSource: string | null;
  voiceDescription: string | null;
  sampleCount: number;
  createdAt: Date;
  updatedAt: Date;
};

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
      description: "Recorded in PoliVid by the account owner for their own videos.",
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
  });
  return rows.map(toView);
};

export const getCharacter = async (userId: string, id: string) =>
  db.character.findFirst({ where: { id, userId } });

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
  },
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
      },
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
  },
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
      },
    });
    if (!input.keepVoice && existing.providerVoiceId && existing.providerVoiceId !== voice.providerVoiceId) {
      await deleteInstantVoice(existing.providerVoiceId).catch(() => undefined);
    }
    return toView(row);
  } catch (error) {
    if (createdVoiceId) await deleteInstantVoice(createdVoiceId).catch(() => undefined);
    throw error;
  }
};

export const deleteCharacter = async (userId: string, id: string) => {
  const row = await getCharacter(userId, id);
  if (!row) return false;
  if (row.providerVoiceId) {
    await deleteInstantVoice(row.providerVoiceId).catch((error) => {
      console.error("Could not delete the cloned voice", error);
    });
  }
  await db.character.delete({ where: { id: row.id } });
  return true;
};
