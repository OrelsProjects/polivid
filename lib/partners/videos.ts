import "server-only";
import { z } from "zod";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { getBalance } from "@/lib/billing/credits";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { CAPTIONS_CREDITS } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { publicAppUrl, signAssetToken } from "@/lib/editor/asset-token";
import { creditsForToolInput } from "@/lib/tools/tool-credits";
import { videoJobCredits } from "@/lib/billing/estimate";
import { getPickableCharacter } from "@/lib/characters/store";
import { CreateVideoError, queueVideoFromInput } from "@/lib/video/create-request";
import { resolveModeTier } from "@/lib/video/modes";
import { skitCharacterProblem, skitCuts, skitLookOf, skitMayDrawCharacter } from "@/lib/video/skit";
import { captionFinishedCredits, queueCaptionsForVideo } from "@/lib/video/caption-finished";
import { cancelVideoJobForUser, getVideoJobForUser } from "@/lib/video/jobs";
import { readJobInput, type JobStep } from "@/lib/video/job-status";
import {
  assertStyleNeeds,
  checkLayoutMedia,
  LayoutRequestError,
  queueLayoutStyle,
  quoteLayoutStyle,
} from "@/lib/video/layout/request";
import { LAYOUT_JOB_MODE, LAYOUT_STYLE_IDS, layoutStyleById } from "@/lib/video/layout/styles";
import { PartnerError } from "./errors";
export { partnerVideoOptions } from "./options";
import {
  canRetry,
  FINISH_KEY,
  finishCredits,
  finishView,
  partnerFailureMessage,
  priceWithFinish,
  readStoredFinish,
  retryPlanFor,
  runFinish,
  storedFinishFrom,
  type FinishQueues,
  type RetryPlan,
} from "./finish";
import {
  CAPTION_STYLE,
  createBodyFor,
  LAYOUT_MEDIA,
  parseVideo,
  type PartnerFinish,
  type PartnerVideoInput,
  type PartnerVideoKind,
} from "./video-request";

export { PARTNER_VIDEO_KINDS, PartnerVideoSchema, type PartnerVideoKind } from "./video-request";

const TOOL_FOR: Record<Exclude<PartnerVideoInput["kind"], "captions" | "skit">, string> = {
  ugc: "make_ugc_video",
  avatar: "make_avatar_video",
  faceless: "make_voiceover_video",
};

/** The finish of a request, checked now so a bad upload or a missing one fails before anything is filmed. */
const checkFinish = (userId: string, finish: PartnerFinish) => {
  if (!finish.style) return;
  const style = layoutStyleById(finish.style)!;
  try {
    assertStyleNeeds(style, checkLayoutMedia(userId, finish.media));
  } catch (error) {
    throw toPartnerError(error);
  }
};

/** A skit's price: each beat's shot, filmed by the tier's model, the same way it's priced when queued. */
const skitCredits = (script: string, tier: string, look: string) => {
  const resolved = resolveModeTier("skit", tier);
  if (!resolved?.model) throw new PartnerError("invalid", "That video can't be priced.");
  const cuts = skitCuts(script, resolved.model.durations);
  if (cuts.length === 0) throw new PartnerError("invalid", "Write the words to say. Notes in brackets are not read aloud.");
  const length = cuts.reduce((sum, cut) => sum + cut.seconds, 0);
  return videoJobCredits({
    mode: "skit",
    tier,
    modelSlug: resolved.model.slug,
    resolution: resolved.resolution,
    length,
    cuts,
    drawsCharacter: skitMayDrawCharacter(skitLookOf(look)),
  });
};

/** A skit needs a character with a picture and a voice. Checked before pricing, so a quote can't promise one. */
const checkSkitCharacter = async (userId: string, input: PartnerVideoInput) => {
  if (input.kind !== "skit") return;
  const character = await getPickableCharacter(userId, input.characterId);
  if (!character) throw new PartnerError("not_found", "That character wasn't found, or has no picture yet.");
  const problem = skitCharacterProblem(character);
  if (problem) throw new PartnerError("invalid", problem);
};

/** What the video itself costs, before any finish. */
const videoCredits = (input: PartnerVideoInput) => {
  if (!hasOpenRouterKey()) return 0;
  if (input.kind === "captions") return CAPTIONS_CREDITS;
  if (input.kind === "skit") return skitCredits(input.script, input.tier, input.look);
  const body = createBodyFor(input);
  const credits = creditsForToolInput(TOOL_FOR[input.kind], { ...body, prompt: body.prompt });
  if (credits === null) throw new PartnerError("invalid", "That video can't be priced.");
  return credits;
};

/** A video's price, split into the video and its finish when it has one. */
const priceOf = (userId: string, input: PartnerVideoInput) => {
  const video = videoCredits(input);
  if ((input.kind !== "ugc" && input.kind !== "avatar" && input.kind !== "skit") || !input.finish) return { credits: video };
  // Layout styles re-cut one take of a speaker. A skit is many shots, so it takes a caption look only.
  if (input.kind === "skit" && input.finish.style) {
    throw new PartnerError("invalid", "A skit can take a caption look, but not a layout style. Styles work on UGC and talking-avatar videos.");
  }
  checkFinish(userId, input.finish);
  return priceWithFinish(video, finishCredits(input.script, input.finish, !hasOpenRouterKey()));
};

/** What a video would cost, without making it. */
export const quotePartnerVideo = async (userId: string, raw: unknown) => {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (record.kind === "layout") {
    const parsed = PartnerLayoutSchema.safeParse({ style: record.style, media: record.media, captions: record.captions });
    if (!parsed.success) throw new PartnerError("invalid", "Send a layout style, and uploads as { key, role }.");
    try {
      const quote = await quoteLayoutStyle(userId, String(record.videoId ?? ""), { style: parsed.data.style, media: parsed.data.media });
      return { credits: quote.credits };
    } catch (error) {
      throw toPartnerError(error);
    }
  }
  if (record.kind === "retry") {
    const plan = await retryPlan(userId, String(record.videoId ?? ""));
    return { credits: await retryCredits(userId, plan) };
  }
  const input = parseVideo(raw);
  await checkSkitCharacter(userId, input);
  return priceOf(userId, input);
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

/** Keeps the finish request on the video's job, where the webhook finds it once the video is filmed. */
const rememberFinish = async (jobId: string, finish: PartnerFinish) => {
  await db.$transaction(async (tx) => {
    const job = await tx.videoJob.findUnique({ where: { id: jobId }, select: { input: true } });
    const input = job?.input && typeof job.input === "object" && !Array.isArray(job.input) ? (job.input as Record<string, unknown>) : {};
    await tx.videoJob.update({
      where: { id: jobId },
      data: { input: JSON.parse(JSON.stringify({ ...input, [FINISH_KEY]: storedFinishFrom(finish) })) },
    });
  });
};

/** Starts a parsed video, with its finish if it has one. */
const startVideo = async (userId: string, input: PartnerVideoInput) => {
  await checkSkitCharacter(userId, input);
  const finish = "finish" in input ? input.finish : undefined;
  if (finish) {
    // The video and its finish are paid for together, so a writer is never left with half of it.
    const { credits } = priceOf(userId, input);
    const balance = (await getBalance(userId)).total;
    if (credits > balance) throw new InsufficientCreditsError(credits, balance);
  }
  await assertRoom(userId);
  try {
    const queued = await queueVideoFromInput(userId, createBodyFor(input));
    // The video is already started, so a finish that can't be kept leaves a plain video, not an error.
    if (finish) await rememberFinish(queued.jobId, finish).catch((error) => console.error("Could not keep the finish request", { jobId: queued.jobId, error }));
    return { id: queued.jobId, credits: queued.credits, status: "queued" as const };
  } catch (error) {
    throw toPartnerError(error);
  }
};

/** Starts a video. Its credits are held now and given back if it fails or is canceled. */
export const createPartnerVideo = async (userId: string, raw: unknown) => startVideo(userId, parseVideo(raw));

export const PartnerLayoutSchema = z.strictObject({
  style: z.enum(LAYOUT_STYLE_IDS),
  media: LAYOUT_MEDIA.optional(),
  /** True or false turns captions on or off. A caption preset's id turns them on in that look. */
  captions: z.union([z.boolean(), CAPTION_STYLE]).optional(),
});

/** Re-edits a finished video in a layout style. Makes a new video; the original is kept. */
export const layoutPartnerVideo = async (userId: string, videoId: string, raw: unknown) => {
  const parsed = PartnerLayoutSchema.safeParse(raw);
  if (!parsed.success) throw new PartnerError("invalid", "Send a layout style, and uploads as { key, role }.");
  await assertRoom(userId);
  try {
    const captions = parsed.data.captions;
    const queued = await queueLayoutStyle(userId, videoId, {
      style: parsed.data.style,
      media: parsed.data.media,
      showText: captions === undefined ? undefined : captions !== false,
      ...(typeof captions === "string" ? { captionPreset: captions } : {}),
    });
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
  skit: "skit",
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
  const stored = await db.videoJob.findFirst({ where: { id: videoId, userId }, select: { input: true } });
  const video =
    job.status === "succeeded" ? await db.video.findFirst({ where: { id: videoId, userId }, select: { title: true, length: true, parentVideoId: true } }) : null;
  return {
    id: job.id,
    kind,
    status: job.status,
    step: job.status === "running" && job.currentStep ? PARTNER_STEP_LABEL[job.currentStep] : null,
    progress: job.progressPct,
    error: job.status === "failed" ? partnerFailureMessage(job.error) : null,
    format: job.format,
    title: video?.title ?? null,
    seconds: video?.length ?? job.length,
    parentId: video?.parentVideoId ?? null,
    createdAt: job.createdAt,
    fileUrl: job.status === "succeeded" ? partnerFileUrl(userId, videoId) : null,
    finish: finishView(readStoredFinish(stored?.input), job.status),
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

/** What trying a failed or canceled video again would make. */
const retryPlan = async (userId: string, videoId: string): Promise<RetryPlan> => {
  const job = await db.videoJob.findFirst({ where: { id: videoId, userId }, select: { status: true, input: true } });
  if (!job) throw new PartnerError("not_found", "That video doesn't exist.");
  if (!canRetry(job.status)) {
    throw new PartnerError("conflict", "Only a failed or canceled video can be tried again.");
  }
  const input = readJobInput(job.input);
  const plan = retryPlanFor(input.mode, input, job.input);
  if (!plan) throw new PartnerError("conflict", "That video can't be tried again. Start a new one.");
  return plan;
};

const retryCredits = async (userId: string, plan: RetryPlan) => {
  if (plan.kind === "create") return priceOf(userId, plan.input).credits;
  if (plan.kind === "captions-finished") {
    const video = await db.video.findFirst({ where: { id: plan.videoId, userId }, select: { length: true } });
    if (!video) throw new PartnerError("not_found", "The video it was made from is gone.");
    return captionFinishedCredits(video.length);
  }
  try {
    return (await quoteLayoutStyle(userId, plan.videoId, { style: plan.style, media: plan.media })).credits;
  } catch (error) {
    throw toPartnerError(error);
  }
};

/** Tries a failed or canceled video again: the same request and finish, as a new video with its own credits. */
export const retryPartnerVideo = async (userId: string, videoId: string) => {
  const plan = await retryPlan(userId, videoId);
  if (plan.kind === "create") return startVideo(userId, plan.input);
  await assertRoom(userId);
  if (plan.kind === "layout") {
    try {
      const queued = await queueLayoutStyle(userId, plan.videoId, {
        style: plan.style,
        media: plan.media,
        showText: plan.showText,
        ...(plan.captionPreset ? { captionPreset: plan.captionPreset } : {}),
      });
      return { id: queued.jobId, credits: queued.credits, status: "queued" as const };
    } catch (error) {
      throw toPartnerError(error);
    }
  }
  try {
    const queued = await queueCaptionsForVideo(userId, plan.videoId, plan.preset);
    return { id: queued.jobId, credits: queued.credits, status: "queued" as const };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw error;
    throw new PartnerError("not_ready", error instanceof Error ? error.message : "That video isn't finished yet.");
  }
};

/** The real queues the finish step uses. */
const FINISH_QUEUES: FinishQueues = {
  layout: (userId, videoId, request) => queueLayoutStyle(userId, videoId, request),
  captions: (userId, videoId, preset) => queueCaptionsForVideo(userId, videoId, preset),
};

/**
 * Starts the finish step of a partner video that just succeeded, and records what happened on its
 * job. The webhook calls this before reporting the video, so the report already names the follow-up.
 * Only the process that claimed the report calls it, so a follow-up is never started twice.
 */
export const startPartnerFinish = async (jobId: string) => {
  const job = await db.videoJob.findUnique({ where: { id: jobId }, select: { userId: true, status: true, input: true } });
  if (!job || job.status !== "succeeded") return;
  const finish = readStoredFinish(job.input);
  if (!finish || finish.status) return;
  const outcome = await runFinish(FINISH_QUEUES, { userId: job.userId, videoId: jobId, finish });
  await db.$transaction(async (tx) => {
    const fresh = await tx.videoJob.findUnique({ where: { id: jobId }, select: { input: true } });
    const input = fresh?.input && typeof fresh.input === "object" && !Array.isArray(fresh.input) ? (fresh.input as Record<string, unknown>) : {};
    const next = { ...finish, ...outcome };
    await tx.videoJob.update({ where: { id: jobId }, data: { input: JSON.parse(JSON.stringify({ ...input, [FINISH_KEY]: next })) } });
  });
};
