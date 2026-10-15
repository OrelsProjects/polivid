import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  assertJobTransition,
  CREDITS_HELD_ON_SUBMIT,
  isJobStatus,
  isJobStep,
  readJobInput,
  type JobStatus,
  type JobStep,
  type VideoJobView,
} from "./job-status";

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
}

export const createQueuedVideoJob = async (userId: string, input: VideoJobInput) => {
  return db.videoJob.create({
    data: {
      userId,
      status: "queued",
      progressPct: 0,
      creditsHeld: CREDITS_HELD_ON_SUBMIT,
      input: {
        prompt: input.prompt,
        style: "bold",
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
      },
      artifacts: {},
    },
  });
};

/**
 * Moves a job only along the allowed path. Failed, canceled, and succeeded
 * release the held credits. There is no user balance yet, so the release is
 * the job column returning to 0.
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
  if (job.status !== "queued" && job.status !== "running") {
    return { result: "finished" as const, status: job.status };
  }
  await transitionVideoJob(job.id, "canceled", { error: "You canceled this video." });
  return { result: "canceled" as const };
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

export const getVideoJobForUser = async (userId: string, jobId: string): Promise<VideoJobView | null> => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  return job ? toView(job) : null;
};

export const listActiveVideoJobs = async (userId: string): Promise<VideoJobView[]> => {
  const jobs = await db.videoJob.findMany({
    where: { userId, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  return jobs.map(toView);
};

const toView = (job: {
  id: string;
  status: string;
  currentStep: string | null;
  progressPct: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  input: Prisma.JsonValue;
}): VideoJobView => {
  if (!isJobStatus(job.status)) throw new Error(`Video job ${job.id} has an unknown status.`);
  const input = readJobInput(job.input);
  return {
    id: job.id,
    status: job.status,
    currentStep: isJobStep(job.currentStep) ? job.currentStep : null,
    progressPct: job.progressPct,
    outputUrl: job.outputUrl,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    prompt: input.prompt,
    format: input.format,
    length: input.length,
  };
};
