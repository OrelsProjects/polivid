import "server-only";
import { improveNarration } from "@/lib/ai/improve";
import { polishPresetFragment } from "@/lib/ai/polish-preset";
import { MAX_IMAGE_PROMPT } from "@/lib/characters/constants";
import { spendCharacterCredit } from "@/lib/characters/spend";
import { getPickableCharacter } from "@/lib/characters/store";
import { STORYBOARD_FRAME_CREDITS, MAX_STORYBOARD_SCENES, MIN_STORYBOARD_SCENES } from "@/lib/coach/storyboard";
import { generateImage } from "@/lib/images/generate";
import { PlanShotsError, planShotsFromInput } from "@/lib/video/plan-shots";
import { createCustomPreset, listCustomPresets } from "@/lib/video/custom-presets";
import { AUTO_PRESET_ID, presetById } from "@/lib/video/presets";
import { MAX_REFERENCE_IMAGES } from "@/lib/video/schema";
import { isCharacterId, OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, formatOf, text, toolError } from "./support";

interface StoryboardScene {
  seconds: number;
  beat: string;
  shotPrompt: string;
}

const scenesOf = (value: unknown): StoryboardScene[] | null => {
  if (!Array.isArray(value) || value.length < MIN_STORYBOARD_SCENES || value.length > MAX_STORYBOARD_SCENES) return null;
  const scenes: StoryboardScene[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const seconds = row.seconds;
    const beat = text(row.beat);
    const shotPrompt = text(row.shotPrompt);
    if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 1 || seconds > 30) return null;
    if (!beat || shotPrompt.length < 3) return null;
    scenes.push({ seconds, beat, shotPrompt });
  }
  return scenes;
};

const lookFor = async (userId: string, presetId: string) => {
  const catalog = presetById(presetId);
  if (catalog && catalog.id !== AUTO_PRESET_ID && catalog.promptFragment) {
    return { fragment: catalog.promptFragment, negative: catalog.negativeFragment };
  }
  if (!presetId || presetId === AUTO_PRESET_ID) return null;
  const custom = (await listCustomPresets(userId)).find((item) => item.id === presetId);
  if (!custom?.promptFragment) return null;
  return { fragment: custom.promptFragment, negative: custom.negativeFragment };
};

const fitPrompt = (shot: string, style: { fragment: string; negative: string | null } | null) => {
  const ending = " No text, no watermark, no logo.";
  const avoid = style?.negative?.trim() ? ` Avoid: ${style.negative.trim()}` : "";
  const fragment = style?.fragment.trim() ?? "";
  const tailBudget = Math.min(180, MAX_IMAGE_PROMPT - ending.length - 40);
  const tail = `${fragment}${avoid}`.slice(0, Math.max(0, tailBudget));
  const extra = `${tail ? `\n\n${tail}` : ""}${ending}`;
  const body = shot.trim().slice(0, Math.max(0, MAX_IMAGE_PROMPT - extra.length));
  return `${body}${extra}`.slice(0, MAX_IMAGE_PROMPT);
};

export const makeStoryboardHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const scenes = scenesOf(row.scenes);
  if (!scenes) return { error: "Add between 1 and 6 scenes, each with a length, a beat, and a shot." };

  const requestedCharacter = text(row.characterId) || ctx.attachedCharacterId;
  let subjectKey = "";
  if (
    isCharacterId(requestedCharacter) &&
    requestedCharacter !== OFF_VOICE_ID &&
    requestedCharacter !== STUDIO_VOICE_ID
  ) {
    const character = await getPickableCharacter(ctx.userId, requestedCharacter).catch(() => null);
    subjectKey = character?.imageKey ?? "";
  }

  const requestedKeys = Array.isArray(row.referenceKeys)
    ? row.referenceKeys.filter((key): key is string => typeof key === "string")
    : [...ctx.attachedReferenceKeys];
  const referenceKeys = [...new Set(requestedKeys.map((key) => key.trim()).filter(Boolean))]
    .filter((key) => key !== subjectKey)
    .slice(0, MAX_REFERENCE_IMAGES);

  const format = formatOf(row.format, "9:16");
  const look = await lookFor(ctx.userId, text(row.presetId)).catch(() => null);
  const holds: { refund: () => Promise<unknown> }[] = [];
  try {
    for (let index = 0; index < scenes.length; index += 1) {
      holds.push(await spendCharacterCredit(ctx.userId, "image"));
    }
  } catch (error) {
    await Promise.all(holds.map((hold) => hold.refund().catch(() => undefined)));
    return toolError(error, "Couldn't make that storyboard.");
  }

  const made = await Promise.all(
    scenes.map(async (scene, index) => {
      const shot = subjectKey
        ? `${scene.shotPrompt} The referenced person is the subject of this shot.`
        : scene.shotPrompt;
      try {
        const image = await generateImage(ctx.userId, {
          prompt: fitPrompt(shot, look),
          format,
          referenceKeys,
          subjectKey: subjectKey || undefined,
          draft: true,
        });
        return { index: index + 1, seconds: scene.seconds, beat: scene.beat, ...image };
      } catch (error) {
        await holds[index]?.refund().catch(() => undefined);
        console.error("Could not make a storyboard frame", error);
        return null;
      }
    }),
  );

  const frames = made.flatMap((frame) => (frame ? [frame] : []));
  if (frames.length === 0) return { error: "Couldn't make the storyboard. Try again." };
  const failed = scenes.length - frames.length;
  return {
    format,
    frames: frames.map((frame) => ({
      index: frame.index,
      seconds: frame.seconds,
      beat: frame.beat,
      imageKey: frame.imageKey,
      url: frame.url,
    })),
    credits: frames.length * STORYBOARD_FRAME_CREDITS,
    ...(failed > 0 ? { failed } : {}),
  };
};

export const planShotsHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const referenceCount =
    typeof row.referenceCount === "number" ? row.referenceCount : ctx.attachedReferenceKeys.length;
  try {
    return await planShotsFromInput({ ...row, referenceCount });
  } catch (error) {
    if (error instanceof PlanShotsError) return { error: error.message };
    throw error;
  }
};

export const improveNarrationHandler: ToolHandler = async (input) => {
  try {
    const script = await improveNarration(text(asRecord(input).description));
    return { script };
  } catch (error) {
    return toolError(error, "Couldn't write that narration.");
  }
};

export const polishLookHandler: ToolHandler = async (input) => {
  try {
    const fragment = await polishPresetFragment(text(asRecord(input).description));
    return { promptFragment: fragment };
  } catch (error) {
    return toolError(error, "Couldn't polish that look.");
  }
};

export const savePresetHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  try {
    const preset = await createCustomPreset(ctx.userId, {
      name: text(row.name),
      promptFragment: text(row.promptFragment),
      negativeFragment: text(row.negativeFragment) || undefined,
    });
    return { id: preset.id, name: preset.name };
  } catch (error) {
    return toolError(error, "Couldn't save that preset.");
  }
};
