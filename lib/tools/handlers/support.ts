import { isEditOp } from "@/lib/video/edit-ops";
import { isVisualMedia } from "@/lib/video/stills";
import { isSwapMethod, isSwapOrientation } from "@/lib/video/swap";
import "server-only";
import { modelIdForQueue } from "@/lib/coach/model-notes";
import { linkThreadVideo } from "@/lib/coach/store";
import { CreateVideoError, queueVideoFromInput } from "@/lib/video/create-request";
import { mergeReferenceKeys } from "@/lib/coach/reference-notes";
import { modeAcceptsReferenceImages, modeNeedsUpload, videoModeById, type ModeUpload, type VideoModeId, modeAllowsMedia } from "@/lib/video/modes";
import { isCharacterId, modeCanNarrate, OFF_VOICE_ID } from "@/lib/voice/constants";
import { MIN_VIDEO_LENGTH, VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";
import { isTalkingHeadMode } from "@/lib/video/models";
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

const stringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined;

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
  if (modeNeedsUpload(mode) && !mode.uploadOptional && !mediaKey) {
    return { error: "Attach the file this mode needs, or pass its upload key." };
  }
  const referenceKeys = modeAcceptsReferenceImages(mode)
    ? mergeReferenceKeys(
        Array.isArray(input.referenceKeys) ? input.referenceKeys.filter((key): key is string => typeof key === "string") : [],
        ctx.attachedReferenceKeys,
      )
    : [];
  // A quick edit and a character swap take their shape and length from the upload, so the Coach does not pass them.
  const fromUpload = modeId === "edit" || modeId === "swap";
  try {
    const model = modeId === "swap" ? undefined : modelIdForQueue(ctx.generationModelId, input.model);
    const queued = await queueVideoFromInput(ctx.userId, {
      prompt: typeof input.prompt === "string" ? input.prompt : "",
      format: input.format ?? (fromUpload ? "9:16" : undefined),
      // A talking head's length comes from its script on the server, and a skit's from its shots. This
      // only fills the shared field.
      length: input.length ?? (fromUpload ? 5 : isTalkingHeadMode(modeId) || modeId === "skit" ? MIN_VIDEO_LENGTH : undefined),
      mode: modeId,
      tier: typeof input.tier === "string" ? input.tier : "pro",
      ...(model ? { model } : {}),
      // A clip count the person picked on the approval card wins over the one the agent typed.
      ...(ctx.clipCount ? { clips: ctx.clipCount } : typeof input.clips === "number" ? { clips: input.clips } : {}),
      cuts: Array.isArray(input.cuts) && input.cuts.length > 0 ? input.cuts : undefined,
      brief: input.brief && typeof input.brief === "object" ? input.brief : undefined,
      attachmentRoles: Array.isArray(input.attachmentRoles) && input.attachmentRoles.length > 0 ? input.attachmentRoles : undefined,
      tool: text(input.template) || undefined,
      backgroundKey: text(input.backgroundKey) || undefined,
      sourceUrl: text(input.sourceUrl) || undefined,
      directionKeys: stringList(input.directionKeys),
      sceneKeys: stringList(input.sceneKeys),
      showText: typeof input.showText === "boolean" ? input.showText : undefined,
      presetId: text(input.presetId) || undefined,
      visualDirection: typeof input.visualDirection === "string" ? input.visualDirection : undefined,
      // A swap puts the character on screen without a voice, so it takes one too.
      characterId: attachedOrRequested(ctx.attachedCharacterId, input.characterId, modeCanNarrate(modeId) || modeId === "swap"),
      characterLookId: text(input.characterLookId) || undefined,
      useCharacterClip: input.useCharacterClip === true ? true : undefined,
      vo: typeof input.vo === "string" ? input.vo : undefined,
      mediaKey,
      referenceKeys: referenceKeys.length > 0 ? referenceKeys : undefined,
      songId: text(input.songId) || undefined,
      direction: typeof input.direction === "string" ? input.direction : undefined,
      scene: typeof input.scene === "string" ? input.scene : undefined,
      media: isVisualMedia(input.media) && modeAllowsMedia(mode, input.media) ? input.media : undefined,
      verbatim: input.verbatim === true ? true : undefined,
      backgroundId: text(input.backgroundId) || undefined,
      op: isEditOp(input.op) ? input.op : undefined,
      opValue: text(input.opValue) || undefined,
      swapMethod: isSwapMethod(input.method) ? input.method : undefined,
      orientation: isSwapOrientation(input.orientation) ? input.orientation : undefined,
      keepSound: typeof input.keepSound === "boolean" ? input.keepSound : undefined,
      smoothTransitions: typeof input.smoothTransitions === "boolean" ? input.smoothTransitions : undefined,
      skitPlan: modeId === "skit" && Array.isArray(input.skitPlan) && input.skitPlan.length > 0 ? input.skitPlan : undefined,
      characterVoice: typeof input.characterVoice === "boolean" ? input.characterVoice : undefined,
      mediaRanges: Array.isArray(input.keep) ? (input.keep as { start: number; end: number }[]) : undefined,
      cast: modeId === "swap" && Array.isArray(input.cast) && input.cast.length > 0 ? (input.cast as { characterId: string; characterLookId?: string }[]) : undefined,
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
