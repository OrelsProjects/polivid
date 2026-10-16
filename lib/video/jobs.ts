import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { refundCredits, reserveCredits } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { videoJobCredits } from "@/lib/billing/estimate";
import { hasVideoMedia, deleteVideoMedia } from "./media-store";
import { jobDetailRows } from "./job-details";
import { clipCountForJob, completedClipCount, filmingClipIndex } from "./job-stages";
import { segmentMediaKey } from "./segments";
import { readStoredSong } from "@/lib/music/song";
import {
  assertJobTransition,
  isJobStatus,
  isJobStep,
  readJobInput,
  type JobInputFields,
  type JobStatus,
  type JobStep,
  type VideoJobView,
} from "./job-status";
import { presetById } from "./presets";

/** Model slug stamped on edit exports, so they can be kept out of the video library. */
export const EDITOR_EXPORT_MODEL = "editor";

export interface VideoJobInput {
  prompt: string;
  format: string;
  length: number;
  model: string;
  mode?: string;
  tier?: string;
  resolution?: string;
  imageKey?: string;
  mediaKey?: string;
  referenceKeys?: string[];
  showText?: boolean;
  projectId?: string;
  presetId?: string;
  visualDirection?: string;
  characterId?: string;
  songId?: string;
  creditsHeld?: number;
}

export const createQueuedVideoJob = async (userId: string, input: VideoJobInput) => {
  const id = randomUUID();
  const creditsHeld = input.creditsHeld ?? 0;
  return db.$transaction(async (tx) => {
    if (creditsHeld > 0) {
      await reserveCredits(
        userId,
        creditsHeld,
        {
          reason: "video_hold",
          refType: "video_job",
          refId: id,
          idempotencyKey: `video_hold:${id}`,
        },
        tx,
      );
    }
    return tx.videoJob.create({
      data: {
        id,
        userId,
        status: "queued",
        progressPct: 0,
        creditsHeld,
        input: {
          prompt: input.prompt,
          style: input.presetId || "bold",
          presetId: input.presetId ?? "",
          visualDirection: input.visualDirection ?? "",
          aspectRatio: input.format,
          duration: input.length,
          model: input.model,
          mode: input.mode ?? "",
          tier: input.tier ?? "",
          resolution: input.resolution ?? "",
          imageKey: input.imageKey ?? input.mediaKey ?? "",
          mediaKey: input.mediaKey ?? input.imageKey ?? "",
          referenceKeys: input.referenceKeys ?? [],
          showText: input.showText !== false,
          projectId: input.projectId ?? "",
          characterId: input.characterId ?? "",
          songId: input.songId ?? "",
        },
        artifacts: {},
      },
    });
  });
};

/**
 * Moves a job only along the allowed path. Failed and canceled jobs refund
 * the held credits. Succeeded jobs keep the charge and clear the hold.
 */
export const transitionVideoJob = async (
  jobId: string,
  to: JobStatus,
  patch: {
    error?: string | null;
    errorDetail?: Prisma.InputJsonValue;
    outputUrl?: string | null;
    triggerRunId?: string | null;
  } = {},
) => {
  return db.$transaction(async (tx) => {
    const job = await tx.videoJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Video job not found.");
    if (!isJobStatus(job.status)) throw new Error(`Video job ${jobId} has an unknown status.`);
    assertJobTransition(job.status, to);

    const now = new Date();
    const terminal = to === "succeeded" || to === "failed" || to === "canceled";
    if (terminal && job.creditsHeld > 0 && (to === "failed" || to === "canceled")) {
      await refundCredits(
        job.userId,
        job.creditsHeld,
        {
          reason: "video_refund",
          refType: "video_job",
          refId: jobId,
          idempotencyKey: job.attempt > 0 ? `video_refund:${jobId}:attempt${job.attempt}` : `video_refund:${jobId}`,
          holdKey: job.attempt > 0 ? `video_hold:${jobId}:attempt${job.attempt}` : `video_hold:${jobId}`,
        },
        tx,
      );
    }
    const updated = await tx.videoJob.updateMany({
      where: { id: jobId, status: job.status },
      data: {
        status: to,
        creditsHeld: terminal ? 0 : job.creditsHeld,
        startedAt: to === "running" ? (job.startedAt ?? now) : job.startedAt,
        finishedAt: terminal ? now : job.finishedAt,
        heartbeatAt: to === "running" ? now : job.heartbeatAt,
        error: patch.error === undefined ? job.error : patch.error,
        errorDetail: patch.errorDetail === undefined ? undefined : patch.errorDetail,
        outputUrl: patch.outputUrl === undefined ? job.outputUrl : patch.outputUrl,
        triggerRunId: patch.triggerRunId === undefined ? job.triggerRunId : patch.triggerRunId,
      },
    });
    if (updated.count !== 1) {
      throw new Error("The video job changed before the status could be saved.");
    }
    return tx.videoJob.findUniqueOrThrow({ where: { id: jobId } });
  });
};

export const cancelVideoJobForUser = async (userId: string, jobId: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return { result: "missing" as const };
  if (!isJobStatus(job.status)) throw new Error(`Video job ${jobId} has an unknown status.`);
  if (job.status !== "queued" && job.status !== "running" && job.status !== "paused") {
    return { result: "finished" as const, status: job.status };
  }
  await transitionVideoJob(job.id, "canceled", { error: "You canceled this video." });
  if (job.status === "paused") {
    await db.video.deleteMany({ where: { id: jobId, userId } });
    await deleteVideoMedia(`${jobId}.mp4`).catch(() => undefined);
  }
  return { result: "canceled" as const };
};

/** Finish the clip already at the model, then stitch what is done and wait. */
export const requestStopAfterClip = async (userId: string, jobId: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return { result: "missing" as const };
  if (job.status !== "running") return { result: "finished" as const, status: job.status };
  const total = clipCountForJob(readJobInput(job.input));
  if (total <= 1) return { result: "single" as const };
  await db.videoJob.update({ where: { id: jobId }, data: { stopAfterClip: true } });
  return { result: "stopping" as const };
};

/** How many segment files are already stored, counting from the first clip. */
export const countStoredSegments = async (jobId: string, total: number) => {
  const ready = await Promise.all(
    Array.from({ length: Math.max(total, 0) }, (_, index) => hasVideoMedia(segmentMediaKey(jobId, index))),
  );
  const gap = ready.findIndex((stored) => !stored);
  return gap === -1 ? ready.length : gap;
};

/**
 * Runs a failed video again from the clips already stored.
 * Holds credits for the whole video again, because the earlier hold was refunded.
 */
export const resumeFailedVideoJob = async (userId: string, jobId: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return { result: "missing" as const };
  if (!isJobStatus(job.status)) throw new Error(`Video job ${jobId} has an unknown status.`);
  if (job.status !== "failed") return { result: "finished" as const, status: job.status };
  const input = readJobInput(job.input);
  const clipTotal = clipCountForJob(input);
  const clipsReady = await countStoredSegments(jobId, clipTotal);
  if (clipsReady < 1) return { result: "empty" as const };
  assertJobTransition(job.status, "running");
  const credits = videoJobCredits({
    mode: input.mode,
    tier: input.tier,
    modelSlug: input.model,
    resolution: input.resolution,
    length: input.length,
  });
  const nextAttempt = job.attempt + 1;
  await db.$transaction(async (tx) => {
    if (credits > 0) {
      await reserveCredits(
        userId,
        credits,
        {
          reason: "video_hold",
          refType: "video_job",
          refId: jobId,
          idempotencyKey: `video_hold:${jobId}:attempt${nextAttempt}`,
        },
        tx,
      );
    }
    const updated = await tx.videoJob.updateMany({
      where: { id: jobId, userId, status: "failed" },
      data: {
        status: "running",
        error: null,
        creditsHeld: credits,
        attempt: nextAttempt,
        stopAfterClip: false,
        finishedAt: null,
        heartbeatAt: new Date(),
        currentStep: "videos",
      },
    });
    if (updated.count !== 1) throw new Error("This video changed. Try again.");
  });
  return { result: "running" as const, clipsReady, clipTotal };
};

/** Continues a paused video at the next clip that was not filmed. */
export const resumePausedVideoJob = async (userId: string, jobId: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return { result: "missing" as const };
  if (job.status !== "paused") return { result: "finished" as const, status: job.status };
  await db.videoJob.update({ where: { id: jobId }, data: { stopAfterClip: false } });
  await transitionVideoJob(jobId, "running", { error: null });
  return { result: "running" as const };
};

/** Updates the visible step while the job stays running. A canceled job is left alone. */
export const markVideoJobProgress = async (jobId: string, step: JobStep, progressPct: number) => {
  const updated = await db.videoJob.updateMany({
    where: { id: jobId, status: "running" },
    data: { currentStep: step, progressPct, heartbeatAt: new Date() },
  });
  return updated.count === 1;
};

export const attachTriggerRun = async (jobId: string, triggerRunId: string) => {
  await db.videoJob.update({ where: { id: jobId }, data: { triggerRunId } });
};

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JobRow = {
  id: string;
  status: string;
  currentStep: string | null;
  progressPct: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  input: Prisma.JsonValue;
  artifacts: Prisma.JsonValue;
  stopAfterClip: boolean;
};

const loadJobLabels = async (userId: string, inputs: JobInputFields[]) => {
  const characterIds = [...new Set(inputs.map((input) => input.characterId).filter((id) => JOB_ID.test(id)))];
  const presetIds = [...new Set(inputs.map((input) => input.presetId).filter((id) => id && !presetById(id)))];
  const [characters, presets] = await Promise.all([
    characterIds.length
      ? db.character.findMany({ where: { userId, id: { in: characterIds } }, select: { id: true, name: true } })
      : [],
    presetIds.length
      ? db.stylePreset.findMany({ where: { userId, id: { in: presetIds } }, select: { id: true, name: true } })
      : [],
  ]);
  return {
    characters: new Map(characters.map((row) => [row.id, row.name])),
    presets: new Map(presets.map((row) => [row.id, row.name])),
  };
};

const viewsFor = async (userId: string, jobs: JobRow[]) => {
  const inputs = jobs.map((job) => readJobInput(job.input));
  const labels = await loadJobLabels(userId, inputs);
  const providerJobs = jobs.length
    ? await db.providerJob.findMany({
        where: { jobId: { in: jobs.map((job) => job.id) } },
        select: { jobId: true, sceneIdx: true, status: true },
      })
    : [];
  const clipsByJob = new Map<string, { sceneIdx: number; status: string }[]>();
  for (const clip of providerJobs) {
    const list = clipsByJob.get(clip.jobId) ?? [];
    list.push(clip);
    clipsByJob.set(clip.jobId, list);
  }
  return jobs.map((job, index) => toView(job, inputs[index]!, labels, clipsByJob.get(job.id) ?? []));
};

export const getVideoJobForUser = async (userId: string, jobId: string): Promise<VideoJobView | null> => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return null;
  const [view] = await viewsFor(userId, [job]);
  return view ?? null;
};

/** Open jobs shown in the video library. Edit exports report progress in the editor instead. */
export const listActiveVideoJobs = async (userId: string): Promise<VideoJobView[]> => {
  const jobs = await db.videoJob.findMany({
    where: { userId, status: { in: ["queued", "running", "paused"] } },
    orderBy: { createdAt: "desc" },
  });
  const visible = jobs.filter((job) => readJobInput(job.input).model !== EDITOR_EXPORT_MODEL);
  return viewsFor(userId, visible);
};

const toView = (
  job: JobRow,
  input: JobInputFields,
  labels: { characters: Map<string, string>; presets: Map<string, string> },
  clips: { sceneIdx: number; status: string }[],
): VideoJobView => {
  if (!isJobStatus(job.status)) throw new Error(`Video job ${job.id} has an unknown status.`);
  const presetName = presetById(input.presetId)?.name ?? labels.presets.get(input.presetId) ?? "";
  const characterName = labels.characters.get(input.characterId) ?? "";
  const currentStep = isJobStep(job.currentStep) ? job.currentStep : null;
  const clipTotal = clipCountForJob(input);
  const clipsDone = completedClipCount(clips);
  return {
    id: job.id,
    status: job.status,
    currentStep,
    progressPct: job.progressPct,
    outputUrl: job.outputUrl,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    prompt: input.prompt,
    format: input.format,
    length: input.length,
    model: input.model,
    mode: input.mode,
    tier: input.tier,
    resolution: input.resolution,
    presetId: input.presetId,
    presetName,
    visualDirection: input.visualDirection,
    characterId: input.characterId,
    characterName,
    showText: input.showText,
    referenceCount: input.referenceKeys.length,
    clipIndex: job.status === "running" && currentStep === "videos" ? filmingClipIndex(clips, clipTotal) : null,
    clipTotal,
    clipsDone,
    stopping: job.stopAfterClip,
    songUrl: readStoredSong(job.artifacts) ? `/api/videos/${job.id}/song` : null,
    details: jobDetailRows({ ...input, presetName, characterName }),
  };
};
