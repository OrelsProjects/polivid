import "server-only";
import { z } from "zod";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { layoutStyleCredits } from "@/lib/billing/estimate";
import { captionPresetById } from "@/lib/editor/caption-presets";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { db } from "@/lib/db";
import { kickVideoJob } from "@/lib/jobs/dispatch";
import { isImageKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import { hasFootage } from "../footage";
import { readJobInput } from "../job-status";
import { createQueuedVideoJob } from "../jobs";
import { isTalkingHeadMode } from "../models";
import { VIDEO_FORMATS, type VideoFormat } from "../schema";
import {
  LAYOUT_JOB_MODE,
  LAYOUT_MEDIA_ROLES,
  LAYOUT_MODEL,
  LAYOUT_STYLE_IDS,
  layoutStyleById,
  styleNeedsProblem,
  type LayoutMedia,
  type LayoutStyle,
} from "./styles";

export class LayoutRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LayoutRequestError";
  }
}

export const LayoutRequestSchema = z.object({
  style: z.enum(LAYOUT_STYLE_IDS),
  media: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(200),
        role: z.enum(LAYOUT_MEDIA_ROLES),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .max(12)
    .optional(),
  showText: z.boolean().optional(),
  /** A caption preset's id. Unset keeps the style's own caption look. */
  captionPreset: z
    .string()
    .trim()
    .refine((id) => captionPresetById(id) !== null, "That caption style doesn't exist.")
    .optional(),
});
export type LayoutRequest = z.infer<typeof LayoutRequestSchema>;

const isFormat = (value: string): value is VideoFormat => (VIDEO_FORMATS as readonly string[]).includes(value);

const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The finished video a style can be applied to: ready, the person's own, with its file. */
const loadSource = async (userId: string, videoId: string) => {
  if (!VIDEO_ID.test(videoId)) throw new LayoutRequestError("Not found.", 404);
  const [video, job] = await Promise.all([
    db.video.findFirst({ where: { id: videoId, userId }, select: { id: true, title: true, format: true, length: true, status: true } }),
    db.videoJob.findFirst({ where: { id: videoId, userId }, select: { input: true } }),
  ]);
  if (!video) throw new LayoutRequestError("Not found.", 404);
  if (video.status !== "ready" || !(await hasFootage(video.id))) {
    throw new LayoutRequestError("That video isn't finished yet.", 409);
  }
  return { video, input: job ? readJobInput(job.input) : null };
};

/** Uploads checked as the person's own, typed as pictures or clips. */
export const checkLayoutMedia = (userId: string, media: LayoutRequest["media"]): LayoutMedia[] =>
  (media ?? []).map((item) => {
    if (!isOwnedUploadKey(userId, item.key)) throw new LayoutRequestError("Use files from your own uploads.", 400);
    const kind = isImageKey(item.key) ? "image" : isVideoKey(item.key) ? "video" : null;
    if (!kind) throw new LayoutRequestError("Uploads must be pictures or video clips.", 400);
    if (item.role === "recording" && kind !== "video") throw new LayoutRequestError("A screen recording must be a video clip.", 400);
    if (item.role !== "recording" && item.role !== "picture" && kind !== "image") {
      throw new LayoutRequestError("Posts and screenshots must be pictures.", 400);
    }
    return { key: item.key, kind, role: item.role, ...(item.note ? { note: item.note } : {}) };
  });

/** A style that needs an upload, such as a post to react to, refuses to run without one. */
export const assertStyleNeeds = (style: LayoutStyle, media: readonly Pick<LayoutMedia, "role">[]) => {
  const problem = styleNeedsProblem(style, media);
  if (problem) throw new LayoutRequestError(problem, 400);
};

/** What applying this style would cost, without queuing anything. */
export const quoteLayoutStyle = async (userId: string, videoId: string, raw: unknown) => {
  const parsed = LayoutRequestSchema.safeParse(raw);
  if (!parsed.success) throw new LayoutRequestError("Pick a layout style.", 400);
  const style = layoutStyleById(parsed.data.style)!;
  const { video } = await loadSource(userId, videoId);
  const media = checkLayoutMedia(userId, parsed.data.media);
  return {
    credits: layoutStyleCredits({ style, seconds: video.length, uploads: media.length, demo: !hasOpenRouterKey() }),
    style,
    video,
    media,
  };
};

/**
 * Applies a layout style to a finished avatar or UGC video. The video's own take is reused, so
 * nothing is filmed again. The result is a new video, with its own edit, linked to the original.
 */
export const queueLayoutStyle = async (userId: string, videoId: string, raw: unknown) => {
  const parsed = LayoutRequestSchema.safeParse(raw);
  if (!parsed.success) throw new LayoutRequestError("Pick a layout style.", 400);
  const style = layoutStyleById(parsed.data.style)!;
  const { video, input } = await loadSource(userId, videoId);
  if (style.avatar && !isTalkingHeadMode(input?.mode)) {
    throw new LayoutRequestError("Layout styles work on Talking Avatar and UGC videos, which have one take of the speaker.", 400);
  }
  const media = checkLayoutMedia(userId, parsed.data.media);
  assertStyleNeeds(style, media);
  const format = isFormat(video.format) ? video.format : "9:16";
  const credits = layoutStyleCredits({ style, seconds: video.length, uploads: media.length, demo: !hasOpenRouterKey() });
  try {
    const job = await createQueuedVideoJob(userId, {
      prompt: video.title,
      format,
      length: Math.max(2, Math.round(video.length)),
      model: LAYOUT_MODEL,
      mode: LAYOUT_JOB_MODE,
      characterId: input?.characterId || undefined,
      showText: parsed.data.showText,
      layout: { style: style.id, sourceVideoId: video.id, media, ...(parsed.data.captionPreset ? { captionPreset: parsed.data.captionPreset } : {}) },
      creditsHeld: credits,
    });
    kickVideoJob(userId, job.id);
    return { jobId: job.id, credits };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw error;
    console.error("Could not start the layout", error);
    throw new LayoutRequestError("Couldn't start the layout. Try again.", 500);
  }
};
