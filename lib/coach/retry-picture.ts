import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { pictureInputForRetry } from "@/lib/coach/picture-preview";
import { referenceKeysFromMessages } from "@/lib/coach/reference-notes";
import { loadCoachMessages } from "@/lib/coach/store";
import { voiceFromMessages } from "@/lib/coach/voice-notes";
import { replacePictureOutput, savedPicture, storedPictureCall, type SavedPicture } from "@/lib/coach/picture-output";
import { db } from "@/lib/db";
import { makeStoryboardHandler } from "@/lib/tools/handlers/plan";
import {
  createCharacterPortraitHandler,
  editImageHandler,
  generateImageHandler,
} from "@/lib/tools/handlers/assets";
import type { PictureTool } from "@/lib/coach/picture-preview";
import type { ToolHandler } from "@/lib/tools/types";

const HANDLERS: Record<PictureTool, ToolHandler> = {
  edit_image: editImageHandler,
  generate_image: generateImageHandler,
  create_character_portrait: createCharacterPortraitHandler,
};

export type RetryPictureFailure = { error: string; status: number };

/** Runs the same picture call again, spends one credit, and stores the new still on the message. */
export const retryCoachPicture = async (
  userId: string,
  threadId: string,
  messageId: string,
  toolCallId: string,
): Promise<SavedPicture | RetryPictureFailure> => {
  const row = await db.coachMessage.findFirst({
    where: { id: messageId, threadId, thread: { userId } },
    select: { id: true, parts: true },
  });
  if (!row) return { error: "That picture isn't in this chat.", status: 404 };

  const call = storedPictureCall(row.parts, toolCallId);
  if (!call) return { error: "That picture isn't in this chat.", status: 404 };

  const messages = await loadCoachMessages(userId, threadId);
  const attached = referenceKeysFromMessages(messages);
  const output = await HANDLERS[call.tool](pictureInputForRetry(call.tool, call.input, attached), {
    userId,
    attachedReferenceKeys: attached,
    attachedCharacterId: "",
    attachedMedia: attached.map((key) => ({ key, kind: "image" as const })),
    timezone: "UTC",
  });
  const picture = savedPicture(output);
  if (!picture) {
    const message =
      output && typeof output === "object" && typeof (output as { error?: unknown }).error === "string"
        ? (output as { error: string }).error
        : "Couldn't retry that picture.";
    return { error: message, status: 400 };
  }

  const parts = replacePictureOutput(row.parts, toolCallId, picture);
  if (!parts) return { error: "That picture isn't in this chat.", status: 404 };
  await db.coachMessage.update({
    where: { id: row.id },
    data: { parts: parts as Prisma.InputJsonValue },
  });
  return picture;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Makes one storyboard frame again from its scene, spends one credit, and swaps it into the stored output. */
export const retryStoryboardFrame = async (
  userId: string,
  threadId: string,
  messageId: string,
  toolCallId: string,
  frameIndex: number,
): Promise<{ frame: Record<string, unknown> } | RetryPictureFailure> => {
  const row = await db.coachMessage.findFirst({
    where: { id: messageId, threadId, thread: { userId } },
    select: { id: true, parts: true },
  });
  const parts = row && Array.isArray(row.parts) ? (row.parts as unknown[]) : null;
  const part = parts?.find(
    (item): item is Record<string, unknown> =>
      isRecord(item) && item.toolCallId === toolCallId && item.type === "tool-make_storyboard",
  );
  if (!row || !parts || !part || part.state !== "output-available" || !isRecord(part.input) || !isRecord(part.output)) {
    return { error: "That storyboard isn't in this chat.", status: 404 };
  }
  const input = part.input;
  const storedOutput = part.output;
  const frames = Array.isArray(storedOutput.frames) ? (storedOutput.frames as unknown[]) : [];
  const old = frames.find((frame) => isRecord(frame) && frame.index === frameIndex);
  const scene = Array.isArray(input.scenes) ? input.scenes[frameIndex - 1] : null;
  if (!old || !isRecord(old) || !isRecord(scene)) return { error: "That frame isn't in this storyboard.", status: 404 };

  const messages = await loadCoachMessages(userId, threadId);
  const attached = referenceKeysFromMessages(messages);
  const output = await makeStoryboardHandler(
    { ...input, scenes: [scene] },
    {
      userId,
      attachedReferenceKeys: attached,
      attachedCharacterId: voiceFromMessages(messages),
      attachedMedia: attached.map((key) => ({ key, kind: "image" as const })),
      timezone: "UTC",
    },
  );
  const made = isRecord(output) && Array.isArray(output.frames) ? output.frames[0] : null;
  if (!isRecord(made) || typeof made.url !== "string") {
    const message =
      isRecord(output) && typeof output.error === "string" ? output.error : "Couldn't make that frame again.";
    return { error: message, status: 400 };
  }
  const frame = { ...old, imageKey: made.imageKey, url: made.url };
  const next = parts.map((item) =>
    item === part
      ? { ...part, output: { ...storedOutput, frames: frames.map((entry) => (entry === old ? frame : entry)) } }
      : item,
  );
  await db.coachMessage.update({ where: { id: row.id }, data: { parts: next as Prisma.InputJsonValue } });
  return { frame };
};
