import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { pictureInputForRetry } from "@/lib/coach/picture-preview";
import { referenceKeysFromMessages } from "@/lib/coach/reference-notes";
import { loadCoachMessages } from "@/lib/coach/store";
import { replacePictureOutput, savedPicture, storedPictureCall, type SavedPicture } from "@/lib/coach/picture-output";
import { db } from "@/lib/db";
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
