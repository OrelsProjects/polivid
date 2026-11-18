import "server-only";
import {
  addCharacterLook,
  addCharacterMedia,
  CharacterLibraryError,
  removeCharacterLook,
  removeCharacterMedia,
  updateCharacterLook,
  updateCharacterMedia,
  updateCharacterProfile,
  voiceFromClipAudio,
  type AddMediaInput,
} from "@/lib/characters/library";
import { getUpload } from "@/lib/storage/s3";
import { withUploadFile } from "@/lib/video/compose/upload-file";
import { extractVoiceSample } from "@/lib/voice/extract-sample";
import { MAX_SAMPLE_BYTES } from "@/lib/voice/constants";
import { isAudioKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import { pickReferenceKeys } from "@/lib/characters/media";
import { getCharacterView } from "@/lib/characters/store";
import type { CharacterSummary } from "@/lib/characters/types";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, text } from "./support";

/** What an agent needs about a character, without upload URLs it can't open anyway. */
export const characterForAgent = (character: CharacterSummary) => ({
  id: character.id,
  name: character.name,
  description: character.description,
  personality: character.personality,
  speakingStyle: character.speakingStyle,
  hasVoice: character.hasVoice,
  voiceSource: character.voiceSource,
  mainPictureKey: character.imageKey,
  looks: character.looks.map((look) => ({ id: look.id, name: look.name, wardrobe: look.wardrobe })),
  media: character.media.map((item) => ({
    id: item.id,
    kind: item.kind,
    key: item.key,
    label: item.label,
    lookId: item.lookId,
    caption: item.caption,
    durationSec: item.durationSec,
    main: item.key === character.imageKey,
  })),
  picturesSentByDefault: pickReferenceKeys({ mainKey: character.imageKey, media: character.media }),
});

const run = async (work: () => Promise<CharacterSummary | null>) => {
  try {
    const character = await work();
    if (!character) return { error: "That character was not found." };
    return characterForAgent(character);
  } catch (error) {
    if (error instanceof CharacterLibraryError) return { error: error.message };
    throw error;
  }
};

const optional = (row: Record<string, unknown>, field: string) => (field in row ? row[field] : undefined);

export const getCharacterHandler: ToolHandler = async (input, ctx) =>
  run(() => getCharacterView(ctx.userId, text(asRecord(input).characterId)));

export const updateCharacterHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return run(() =>
    updateCharacterProfile(ctx.userId, text(row.characterId), {
      name: optional(row, "name"),
      description: optional(row, "description"),
      personality: optional(row, "personality"),
      speakingStyle: optional(row, "speakingStyle"),
    }),
  );
};

export const characterAddMediaHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const items = Array.isArray(row.items) ? (row.items as AddMediaInput[]) : [];
  return run(() => addCharacterMedia(ctx.userId, text(row.characterId), items));
};

export const characterUpdateMediaHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return run(() =>
    updateCharacterMedia(ctx.userId, text(row.characterId), text(row.mediaId), {
      label: optional(row, "label"),
      lookId: optional(row, "lookId"),
      caption: optional(row, "caption"),
      main: row.main === true ? true : undefined,
    }),
  );
};

export const characterRemoveMediaHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return run(() => removeCharacterMedia(ctx.userId, text(row.characterId), text(row.mediaId)));
};

export const characterAddLookHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  try {
    const result = await addCharacterLook(ctx.userId, text(row.characterId), { name: row.name, wardrobe: row.wardrobe });
    return { lookId: result.lookId, character: result.character ? characterForAgent(result.character) : null };
  } catch (error) {
    if (error instanceof CharacterLibraryError) return { error: error.message };
    throw error;
  }
};

export const characterUpdateLookHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return run(() =>
    updateCharacterLook(ctx.userId, text(row.characterId), text(row.lookId), {
      name: optional(row, "name"),
      wardrobe: optional(row, "wardrobe"),
    }),
  );
};

export const characterRemoveLookHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return run(() => removeCharacterLook(ctx.userId, text(row.characterId), text(row.lookId)));
};

export const setCharacterVoiceHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const keys = Array.isArray(row.mediaKeys) ? row.mediaKeys.map(text).filter(Boolean).slice(0, 3) : [];
  if (keys.length === 0) return { error: "Pass one to three audio or video upload keys." };
  if (!(await getCharacterView(ctx.userId, text(row.characterId)))) return { error: "That character was not found." };
  const files: { bytes: Uint8Array; type: string; name: string }[] = [];
  for (const key of keys) {
    if (!isOwnedUploadKey(ctx.userId, key)) return { error: "Use recordings from your own uploads." };
    if (isVideoKey(key)) {
      try {
        files.push(await withUploadFile(ctx.userId, key, extractVoiceSample));
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Couldn't extract that video's audio." };
      }
      continue;
    }
    if (!isAudioKey(key)) return { error: "Use an MP3, M4A, or WAV recording." };
    const { bytes, contentType } = await getUpload(key);
    if (bytes.byteLength > MAX_SAMPLE_BYTES) return { error: "That recording is over 8 MB. Use a shorter one, one to two minutes is plenty." };
    files.push({ bytes, type: contentType, name: key.split("/").pop() ?? "voice.mp3" });
  }
  return run(() => voiceFromClipAudio(ctx.userId, text(row.characterId), files));
};
