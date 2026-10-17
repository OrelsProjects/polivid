import "server-only";
import { startProductionFromInput } from "@/lib/production/create-request";
import { isCharacterId, OFF_VOICE_ID } from "@/lib/voice/constants";
import type { ToolHandler } from "@/lib/tools/types";
import type { VideoModeId } from "@/lib/video/modes";
import { asRecord, queueModeVideo, toolError } from "./support";

const modeHandler = (mode: VideoModeId): ToolHandler => async (input, ctx) => queueModeVideo(ctx, mode, asRecord(input));

export const makePromptVideoHandler = modeHandler("prompt");
export const makeVoiceoverVideoHandler = modeHandler("voiceover");
export const makeMotionGraphicsHandler = modeHandler("motion-graphics");
export const makeMusicVideoHandler = modeHandler("music");
export const makeAvatarVideoHandler = modeHandler("avatar");
export const makeImageVideoHandler = modeHandler("image");
export const makeAvCutHandler = modeHandler("av-to-video");
export const makeLyricsVideoHandler = modeHandler("lyrics");
export const addCaptionsHandler = modeHandler("captions");

export const createVideoHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const mode = typeof row.mode === "string" ? row.mode : "prompt";
  return queueModeVideo(ctx, mode as VideoModeId, row);
};

export const startProductionHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const requested = row.characterId;
  const characterId =
    isCharacterId(ctx.attachedCharacterId) && ctx.attachedCharacterId !== OFF_VOICE_ID
      ? ctx.attachedCharacterId
      : isCharacterId(requested)
        ? requested
        : OFF_VOICE_ID;
  try {
    return await startProductionFromInput(ctx.userId, { ...row, characterId });
  } catch (error) {
    return toolError(error, "Couldn't start that production.");
  }
};
