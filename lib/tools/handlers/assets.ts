import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { getPickableCharacter } from "@/lib/characters/store";
import { createCharacterFromInput } from "@/lib/characters/create-request";
import { generateCharacterImage } from "@/lib/characters/generate-image";
import { spendCharacterCredit } from "@/lib/characters/spend";
import { generateImage } from "@/lib/images/generate";
import { createSongDraft, songCharacterId } from "@/lib/music/song-draft";
import { designVoicePreviews } from "@/lib/production/adapters/elevenlabs";
import { isImageKey } from "@/lib/storage/upload-key";
import { isVideoTier, resolveModeTier } from "@/lib/video/modes";
import { PREVIEW_LINE } from "@/lib/voice/speak";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, formatOf, text, toolError } from "./support";

const spendImage = async (userId: string, run: () => Promise<unknown>) => {
  const spend = await spendCharacterCredit(userId, "image");
  try {
    return await run();
  } catch (error) {
    await spend.refund().catch(() => undefined);
    return toolError(error, "Couldn't make that picture.");
  }
};

const pictureKey = (requested: unknown, attached: readonly string[]) => {
  const key = text(requested);
  if (key) return key;
  return attached.find((item) => isImageKey(item));
};

export const generateImageHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const referenceKeys = Array.isArray(row.referenceKeys)
    ? row.referenceKeys.filter((key): key is string => typeof key === "string")
    : [...ctx.attachedReferenceKeys];
  return spendImage(ctx.userId, () =>
    generateImage(ctx.userId, {
      prompt: text(row.prompt),
      format: formatOf(row.format),
      referenceKeys,
    }),
  );
};

export const editImageHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const sourceKey = pictureKey(row.sourceKey, [
    ...ctx.attachedReferenceKeys,
    ...ctx.attachedMedia.filter((item) => item.kind === "image").map((item) => item.key),
  ]);
  if (!sourceKey) return { error: "Attach the picture to edit, or pass its upload key." };
  return spendImage(ctx.userId, () =>
    generateImage(ctx.userId, {
      prompt: text(row.prompt),
      format: formatOf(row.format),
      sourceKey,
    }),
  );
};

export const composeSongHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const tier = typeof row.tier === "string" && isVideoTier(row.tier) ? row.tier : "pro";
  const model = resolveModeTier("lyrics", tier)?.model;
  if (!model) return { error: "Pick a quality tier." };
  const requested = text(row.characterId);
  const characterId = songCharacterId(requested || ctx.attachedCharacterId);
  try {
    const character = characterId ? await getPickableCharacter(ctx.userId, characterId) : null;
    if (characterId && !character) return { error: "Pick a character from your library." };
    const hasSinger = ctx.attachedReferenceKeys.length > 0 || Boolean(character?.imageKey && model.referenceImages);
    const { draft, credits } = await createSongDraft(ctx.userId, {
      prompt: text(row.prompt),
      length: typeof row.length === "number" ? row.length : 30,
      model: model.slug,
      characterId,
      hasSinger,
      demo: !hasOpenRouterKey(),
    });
    return { songId: draft.id, url: `/api/songs/${draft.id}`, seconds: draft.seconds, credits };
  } catch (error) {
    return toolError(error, "Couldn't make the song.");
  }
};

export const createCharacterPortraitHandler: ToolHandler = async (input, ctx) => {
  const spend = await spendCharacterCredit(ctx.userId, "character_image");
  try {
    return await generateCharacterImage(ctx.userId, text(asRecord(input).description));
  } catch (error) {
    await spend.refund().catch(() => undefined);
    return toolError(error, "Couldn't generate that portrait.");
  }
};

export const designVoiceHandler: ToolHandler = async (input, ctx) => {
  const spend = await spendCharacterCredit(ctx.userId, "character_voice");
  try {
    const previews = await designVoicePreviews(text(asRecord(input).description), PREVIEW_LINE);
    return {
      previews: previews.map((preview) => ({ generatedVoiceId: preview.generatedVoiceId })),
    };
  } catch (error) {
    await spend.refund().catch(() => undefined);
    return toolError(error, "Couldn't design that voice.");
  }
};

export const createCharacterHandler: ToolHandler = async (input, ctx) => {
  try {
    const character = await createCharacterFromInput(ctx.userId, input);
    return { id: character.id, name: character.name, hasVoice: character.hasVoice };
  } catch (error) {
    return toolError(error, "Couldn't save that character.");
  }
};
