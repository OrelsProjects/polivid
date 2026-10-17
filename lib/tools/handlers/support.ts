import "server-only";
import { linkThreadVideo } from "@/lib/coach/store";
import { CreateVideoError, queueVideoFromInput } from "@/lib/video/create-request";
import { mergeReferenceKeys } from "@/lib/coach/reference-notes";
import { modeAcceptsReferenceImages, modeNeedsUpload, videoModeById, type ModeUpload, type VideoModeId } from "@/lib/video/modes";
import { isCharacterId, modeCanNarrate, OFF_VOICE_ID } from "@/lib/voice/constants";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import type { ToolContext } from "@/lib/tools/types";

export const formatOf = (value: unknown, fallback: VideoFormat = "1:1"): VideoFormat =>
  typeof value === "string" && (VIDEO_FORMATS as readonly string[]).includes(value) ? (value as VideoFormat) : fallback;

export const asRecord = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" ? (input as Record<string, unknown>) : {};

export const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const toolError = (error: unknown, fallback: string) => {
  if (error instanceof CreateVideoError) {
    if (!error.issues?.length) return { error: error.message };
    const details = error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
    return { error: `${error.message}: ${details}` };
  }
  if (error instanceof InsufficientCreditsError) return { error: error.message };
  if (error instanceof Error && error.message) return { error: error.message };
  return { error: fallback };
};

const attachedOrRequested = (attached: string, requested: unknown, allowed: boolean) => {
  if (!allowed) return OFF_VOICE_ID;
  if (isCharacterId(attached) && attached !== OFF_VOICE_ID) return attached;
  if (isCharacterId(requested)) return requested;
  return OFF_VOICE_ID;
};

const firstOfKind = (ctx: ToolContext, kind: "image" | "audio" | "video") =>
  ctx.attachedMedia.find((item) => item.kind === kind)?.key;

const mediaForUpload = (ctx: ToolContext, upload: ModeUpload) => {
  if (upload === "audio") return firstOfKind(ctx, "audio");
  if (upload === "video") return firstOfKind(ctx, "video");
  if (upload === "image") return firstOfKind(ctx, "image") ?? ctx.attachedReferenceKeys[0];
  if (upload === "media") return firstOfKind(ctx, "video") ?? firstOfKind(ctx, "audio");
  return undefined;
};

/** Queues one Create mode. Attached pictures, files, and the character fill gaps the model left empty. */
export const queueModeVideo = async (ctx: ToolContext, modeId: VideoModeId, input: Record<string, unknown>) => {
  const mode = videoModeById(modeId);
  if (!mode) return { error: "That mode is not available." };
  const requestedMedia = text(input.mediaKey);
  const mediaKey = requestedMedia || (modeNeedsUpload(mode) ? mediaForUpload(ctx, mode.upload) : undefined);
  if (modeNeedsUpload(mode) && !mediaKey) {
    return { error: "Attach the file this mode needs, or pass its upload key." };
  }
  const referenceKeys = modeAcceptsReferenceImages(mode)
    ? mergeReferenceKeys(
        Array.isArray(input.referenceKeys) ? input.referenceKeys.filter((key): key is string => typeof key === "string") : [],
        ctx.attachedReferenceKeys,
      )
    : [];
  try {
    const queued = await queueVideoFromInput(ctx.userId, {
      prompt: typeof input.prompt === "string" ? input.prompt : "",
      format: input.format,
      length: input.length,
      mode: modeId,
      tier: typeof input.tier === "string" ? input.tier : "pro",
      showText: typeof input.showText === "boolean" ? input.showText : undefined,
      presetId: text(input.presetId) || undefined,
      visualDirection: typeof input.visualDirection === "string" ? input.visualDirection : undefined,
      characterId: attachedOrRequested(ctx.attachedCharacterId, input.characterId, modeCanNarrate(modeId)),
      mediaKey,
      referenceKeys: referenceKeys.length > 0 ? referenceKeys : undefined,
      songId: text(input.songId) || undefined,
      direction: typeof input.direction === "string" ? input.direction : undefined,
      scene: typeof input.scene === "string" ? input.scene : undefined,
    });
    if (ctx.threadId && queued && typeof queued === "object" && "jobId" in queued && typeof queued.jobId === "string") {
      await linkThreadVideo(ctx.userId, ctx.threadId, queued.jobId);
    }
    return queued;
  } catch (error) {
    if (error instanceof CreateVideoError || error instanceof InsufficientCreditsError) return toolError(error, "Couldn't queue that video.");
    throw error;
  }
};
