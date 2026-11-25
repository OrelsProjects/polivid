import "server-only";
import { z } from "zod";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { CAPTIONS_CREDITS } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { publicAppUrl, signAssetToken } from "@/lib/editor/asset-token";
import { creditsForToolInput } from "@/lib/tools/tool-credits";
import { CreateVideoError, queueVideoFromInput } from "@/lib/video/create-request";
import { cancelVideoJobForUser, getVideoJobForUser } from "@/lib/video/jobs";
import type { JobStep } from "@/lib/video/job-status";
import { LayoutRequestError, queueLayoutStyle, quoteLayoutStyle } from "@/lib/video/layout/request";
import { LAYOUT_JOB_MODE, LAYOUT_MEDIA_ROLES, LAYOUT_STYLE_IDS } from "@/lib/video/layout/styles";
import { PartnerError } from "./errors";
import { createBodyFor, MEDIA_KEY, parseVideo, type PartnerVideoInput, type PartnerVideoKind } from "./video-request";

export { PARTNER_VIDEO_KINDS, PartnerVideoSchema, type PartnerVideoKind } from "./video-request";

const TOOL_FOR: Record<Exclude<PartnerVideoInput["kind"], "captions">, string> = {
  ugc: "make_ugc_video",
  avatar: "make_avatar_video",
  faceless: "make_voiceover_video",
};

/** What a video would cost, without making it. */
export const quotePartnerVideo = async (userId: string, raw: unknown) => {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (record.kind === "layout") {
    try {
      const quote = await quoteLayoutStyle(userId, String(record.videoId ?? ""), { style: record.style, media: record.media });
      return { credits: quote.credits };
    } catch (error) {
      throw toPartnerError(error);
    }
  }
  const input = parseVideo(raw);
  if (!hasOpenRouterKey()) return { credits: 0 };
  if (input.kind === "captions") return { credits: CAPTIONS_CREDITS };
  const body = createBodyFor(input);
  const credits = creditsForToolInput(TOOL_FOR[input.kind], { ...body, prompt: body.prompt });
  if (credits === null) throw new PartnerError("invalid", "That video can't be priced.");
  return { credits };
};

const toPartnerError = (error: unknown) => {
  if (error instanceof CreateVideoError) {
    return new PartnerError(error.status === 404 ? "not_found" : error.status === 409 ? "conflict" : "invalid", error.message);
  }
  if (error instanceof LayoutRequestError) {
    return new PartnerError(error.status === 404 ? "not_found" : error.status === 409 ? "not_ready" : "invalid", error.message);
  }
  return error;
};

/** At most this many of one user's videos may be in progress at once. */
const MAX_OPEN_VIDEOS = 3;

const assertRoom = async (userId: string) => {
  const open = await db.videoJob.count({ where: { userId, status: { in: ["queued", "running"] } } });
  if (open >= MAX_OPEN_VIDEOS) throw new PartnerError("conflict", `Wait for one of the ${MAX_OPEN_VIDEOS} videos in progress to finish.`);
};

/** Starts a video. Its credits are held now and given back if it fails or is canceled. */
export const createPartnerVideo = async (userId: string, raw: unknown) => {
  const input = parseVideo(raw);
  await assertRoom(userId);
  try {
    const queued = await queueVideoFromInput(userId, createBodyFor(input));
    return { id: queued.jobId, credits: queued.credits, status: "queued" as const };
  } catch (error) {
    throw toPartnerError(error);
  }
};

export const PartnerLayoutSchema = z.strictObject({
  style: z.enum(LAYOUT_STYLE_IDS),
  media: z
    .array(z.strictObject({ key: MEDIA_KEY, role: z.enum(LAYOUT_MEDIA_ROLES), note: z.string().trim().max(300).optional() }))
    .max(12)
    .optional(),
  captions: z.boolean().optional(),
});

/** Re-edits a finished video in a layout style. Makes a new video; the original is kept. */
export const layoutPartnerVideo = async (userId: string, videoId: string, raw: unknown) => {
  const parsed = PartnerLayoutSchema.safeParse(raw);
  if (!parsed.success) throw new PartnerError("invalid", "Send a layout style, and uploads as { key, role }.");
  await assertRoom(userId);
  try {
    const queued = await queueLayoutStyle(userId, videoId, { style: parsed.data.style, media: parsed.data.media, showText: parsed.data.captions });
    return { id: queued.jobId, credits: queued.credits, status: "queued" as const };
  } catch (error) {
    throw toPartnerError(error);
  }
};

const KIND_OF_MODE: Record<string, PartnerVideoKind> = {
  ugc: "ugc",
  avatar: "avatar",
  captions: "captions",
  voiceover: "faceless",
  [LAYOUT_JOB_MODE]: "layout",
};

/** How long a file link works. The partner copies the file to its own storage well inside this. */
const FILE_LINK_MS = 24 * 60 * 60 * 1000;

/** A link to the finished file that needs no sign-in. Works for a day. */
export const partnerFileUrl = (userId: string, videoId: string) =>
  `${publicAppUrl()}/api/editor/assets/${encodeURIComponent(signAssetToken(userId, { type: "video", videoId }, FILE_LINK_MS))}`;

/**
 * What a running video is doing, in words a partner can show as is. Neutral on purpose: no model or
 * provider names, so "Generating with the model" from the app becomes "Filming the video".
 */
export const PARTNER_STEP_LABEL: Record<JobStep, string> = {
  script: "Writing the script",
  images: "Making the frames",
  videos: "Filming the video",
  render: "Putting it together",
  finalize: "Saving the video",
};

/**
 * A video as a partner sees it: what it is, where it stands, and its file once it's done. Model and
 * provider names are left out, so nothing about how it was made reaches the partner's users.
 */
export const partnerVideoView = async (userId: string, videoId: string) => {
  const job = await getVideoJobForUser(userId, videoId);
  if (!job) return null;
  const kind = KIND_OF_MODE[job.mode];
  if (!kind) return null;
  const video =
    job.status === "succeeded" ? await db.video.findFirst({ where: { id: videoId, userId }, select: { title: true, length: true, parentVideoId: true } }) : null;
  return {
    id: job.id,
    kind,
    status: job.status,
    step: job.status === "running" && job.currentStep ? PARTNER_STEP_LABEL[job.currentStep] : null,
    progress: job.progressPct,
    error: job.status === "failed" ? job.error : null,
    format: job.format,
    title: video?.title ?? null,
    seconds: video?.length ?? job.length,
    parentId: video?.parentVideoId ?? null,
    createdAt: job.createdAt,
    fileUrl: job.status === "succeeded" ? partnerFileUrl(userId, videoId) : null,
  };
};

/** The partner user's recent videos, newest first. */
export const listPartnerVideos = async (userId: string, limit = 50) => {
  const jobs = await db.videoJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    select: { id: true },
  });
  const views = await Promise.all(jobs.map((job) => partnerVideoView(userId, job.id)));
  return views.filter((view) => view !== null);
};

export const cancelPartnerVideo = async (userId: string, videoId: string) => {
  const outcome = await cancelVideoJobForUser(userId, videoId);
  if (outcome.result === "missing") throw new PartnerError("not_found", "That video doesn't exist.");
  if (outcome.result === "finished") throw new PartnerError("conflict", "That video already finished.");
  return { id: videoId, status: "canceled" as const };
};
