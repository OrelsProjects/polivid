import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { captionPresetById } from "@/lib/editor/caption-presets";
import { db } from "@/lib/db";
import { kickVideoJob } from "@/lib/jobs/dispatch";
import { CAPTIONS_MODEL } from "./captions";
import { hasFootage } from "./footage";
import { createQueuedVideoJob } from "./jobs";
import { MIN_VIDEO_LENGTH, VIDEO_FORMATS, type VideoFormat } from "./schema";

const isFormat = (value: string): value is VideoFormat => (VIDEO_FORMATS as readonly string[]).includes(value);

/** What captioning a finished video this long costs. */
export const captionFinishedCredits = (seconds: number) =>
  videoJobCredits({ demo: !hasOpenRouterKey(), mode: "captions", length: Math.max(MIN_VIDEO_LENGTH, Math.round(seconds)) });

/**
 * Draws captions into one of the person's finished videos, as a new video linked to it. The take's
 * words are reused, so nothing is filmed or spoken again. `preset` is a caption preset's id, or
 * empty for the plain look.
 */
export const queueCaptionsForVideo = async (userId: string, videoId: string, preset: string) => {
  if (preset && !captionPresetById(preset)) throw new Error("That caption style doesn't exist.");
  const video = await db.video.findFirst({
    where: { id: videoId, userId },
    select: { id: true, title: true, format: true, length: true, status: true },
  });
  if (!video || video.status !== "ready" || !(await hasFootage(video.id))) throw new Error("That video isn't finished yet.");
  const credits = captionFinishedCredits(video.length);
  const job = await createQueuedVideoJob(userId, {
    prompt: video.title || "Add captions to this video.",
    format: isFormat(video.format) ? video.format : "9:16",
    length: Math.max(MIN_VIDEO_LENGTH, Math.round(video.length)),
    model: CAPTIONS_MODEL,
    mode: "captions",
    tier: "pro",
    showText: true,
    captioning: { sourceVideoId: video.id, preset },
    creditsHeld: credits,
  });
  kickVideoJob(userId, job.id, "Captions stopped");
  return { jobId: job.id, credits };
};
