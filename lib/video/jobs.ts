import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { refundCredits, reserveCredits } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { videoJobCredits } from "@/lib/billing/estimate";
import { clipPreviewSlots } from "./clip-preview";
import { hasVideoMedia, deleteStoredVideoFiles, deleteVideoMedia } from "./media-store";
import { jobDetailRows } from "./job-details";
import { clipCountForJob, completedClipCount, filmingClipIndex } from "./job-stages";
import { segmentMediaKey } from "./segments";
import { readStoredSong } from "@/lib/music/song";
import {
  assertJobTransition,
  JobTransitionError,
  isFilmingStalled,
  isJobStatus,
  isJobStep,
  readJobInput,
  type JobInputFields,
  type JobStatus,
  type JobStep,
  type VideoJobView,
} from "./job-status";
import { generationModelById } from "./models";
import { isModelChoice } from "./model-choice";
import { presetById } from "./presets";
import { stillPictureCount } from "./script-markup";
import type { AttachmentAssignment, PromptBrief } from "./shot-plan";

/** Model slug stamped on edit exports, so they can be kept out of the video library. */
export const EDITOR_EXPORT_MODEL = "editor";

export interface VideoJobInput {
  prompt: string;
  format: string;
  length: number;
  model: string;
  mode?: string;
  /** Catalog tool the form was opened with. Empty when it was just the mode. */
  tool?: string;
  /** `stills` draws and animates pictures instead of filming. */
  media?: string;
  /** Read the script word for word. */
  verbatim?: boolean;
  /** The page the script text was read from. */
  sourceUrl?: string;
  /** The quick edit an edit job makes, and its setting. */
  op?: string;
  opValue?: string;
  /** Built-in clip behind a loop video. */
  backgroundId?: string;
  /** The person's own clip behind a loop video. */
  backgroundKey?: string;
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
  direction?: string;
  scene?: string;
  directionKeys?: string[];
  sceneKeys?: string[];
  songId?: string;
  cuts?: { seconds: number; camera: string; images?: number[]; action?: string; samePlace?: boolean }[];
  /** Spoken lines from the brief. `none` keeps only the footage sound. */
  vo?: string;
  brief?: PromptBrief;
  attachmentRoles?: AttachmentAssignment[];
  creditsHeld?: number;
  /** Clips the person chose. Unset means the fewest the model needs. */
  clips?: number;
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
          tool: input.tool ?? "",
          media: input.media ?? "",
          verbatim: input.verbatim === true,
          sourceUrl: input.sourceUrl ?? "",
          op: input.op ?? "",
          opValue: input.opValue ?? "",
          backgroundId: input.backgroundId ?? "",
          backgroundKey: input.backgroundKey ?? "",
          tier: input.tier ?? "",
          resolution: input.resolution ?? "",
          imageKey: input.imageKey ?? input.mediaKey ?? "",
          mediaKey: input.mediaKey ?? input.imageKey ?? "",
          referenceKeys: input.referenceKeys ?? [],
          showText: input.showText !== false,
          projectId: input.projectId ?? "",
          characterId: input.characterId ?? "",
          direction: input.direction ?? "",
          scene: input.scene ?? "",
          directionKeys: input.directionKeys ?? [],
          sceneKeys: input.sceneKeys ?? [],
          songId: input.songId ?? "",
          vo: input.vo ?? "",
          cuts: input.cuts ?? [],
          clips: input.clips ?? 0,
          brief: input.brief
            ? {
                subject: input.brief.subject,
                setting: input.brief.setting,
                director: input.brief.director,
                style: input.brief.style,
                mustKeep: input.brief.mustKeep,
                mustAvoid: input.brief.mustAvoid,
              }
            : null,
          attachmentRoles: (input.attachmentRoles ?? []).map((role) => ({ index: role.index, role: role.role })),
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

const OPEN_JOB: ReadonlySet<JobStatus> = new Set(["queued", "running", "paused"]);

/**
 * Removes one video for good: the library row, the job, provider rows, and the
 * stored files. An in-progress job is canceled first so held credits come back
 * and filming stops. Credit history stays.
 */
export const deleteVideoForUser = async (userId: string, id: string) => {
  const [video, job] = await Promise.all([
    db.video.findFirst({ where: { id, userId }, select: { id: true } }),
    db.videoJob.findFirst({ where: { id, userId }, select: { id: true, status: true } }),
  ]);
  if (!video && !job) return false;

  if (job && isJobStatus(job.status) && OPEN_JOB.has(job.status)) {
    try {
      await transitionVideoJob(job.id, "canceled", { error: "You deleted this video." });
    } catch (error) {
      const finished =
        error instanceof JobTransitionError ||
        (error instanceof Error &&
          (error.message === "Video job not found." ||
            error.message === "The video job changed before the status could be saved."));
      if (!finished) throw error;
    }
  }

  const removed = await db.$transaction(async (tx) => {
    // Lock the job row so a render that is mid-save cannot write the video back after this.
    await tx.videoJob.updateMany({ where: { id, userId }, data: { heartbeatAt: new Date() } });
    await tx.editProject.updateMany({
      where: { userId, exportVideoId: id },
      data: { exportVideoId: null, exportVersion: null },
    });
    await tx.coachThread.updateMany({
      where: { userId, videoJobId: id },
      data: { videoJobId: null },
    });
    await tx.providerJob.deleteMany({ where: { jobId: id } });
    const videos = await tx.video.deleteMany({ where: { id, userId } });
    const jobs = await tx.videoJob.deleteMany({ where: { id, userId } });
    return videos.count + jobs.count > 0;
  });

  if (removed) {
    await deleteStoredVideoFiles(id).catch((error) => {
      console.error("Could not delete the video files", error);
    });
  }
  return removed;
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
    media: input.media,
    pictures: stillPictureCount(input),
    tier: input.tier,
    modelSlug: input.model,
    resolution: input.resolution,
    length: input.length,
    referenceCount: input.referenceKeys.length,
    songReady: Boolean(input.songId),
    cuts: input.cuts,
    clips: input.clips || undefined,
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

/**
 * Switches a paused job onto another footage model and films the clips that are left.
 * The earlier credit hold stays. Finished clips are kept.
 */
export const continueVideoWithModel = async (userId: string, jobId: string, modelId: string) => {
  const model = generationModelById(modelId);
  if (!model) return { result: "invalid" as const };
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return { result: "missing" as const };
  if (!isJobStatus(job.status)) throw new Error(`Video job ${jobId} has an unknown status.`);
  if (job.status !== "paused" || !isModelChoice(job.errorDetail)) {
    return { result: "finished" as const, status: job.status };
  }
  const input = readJobInput(job.input);
  if (!(model.aspectRatios as readonly string[]).includes(input.format)) {
    return { result: "format" as const, name: model.name };
  }
  if (model.slug === input.model) return { result: "same" as const };
  const raw =
    job.input && typeof job.input === "object" && !Array.isArray(job.input)
      ? (job.input as Record<string, unknown>)
      : {};
  const updated = await db.videoJob.updateMany({
    where: { id: jobId, userId, status: "paused" },
    data: {
      input: { ...raw, model: model.slug },
      error: null,
      errorDetail: { code: "cleared" },
    },
  });
  if (updated.count !== 1) return { result: "finished" as const, status: job.status };
  await transitionVideoJob(jobId, "running", { error: null });
  return { result: "running" as const };
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
  heartbeatAt: Date | null;
  input: Prisma.JsonValue;
  artifacts: Prisma.JsonValue;
  stopAfterClip: boolean;
  errorDetail: Prisma.JsonValue | null;
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

const viewsFor = async (userId: string, jobs: JobRow[], readyByJob?: Map<string, readonly number[]>) => {
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
  return jobs.map((job, index) =>
    toView(job, inputs[index]!, labels, clipsByJob.get(job.id) ?? [], readyByJob?.get(job.id)),
  );
};

/**
 * Indexes whose shot files exist. Null when this job is not filming a multi-clip video,
 * so the library list does not stat every shot on each poll.
 */
const filmingPreviewIndexes = async (job: JobRow): Promise<readonly number[] | null> => {
  const waitingForModel = job.status === "paused" && isModelChoice(job.errorDetail);
  if (job.status !== "running" && !waitingForModel) return null;
  if (job.currentStep !== "videos" && job.currentStep !== "render") return null;
  const input = readJobInput(job.input);
  const slots = clipPreviewSlots(job.artifacts, input, new Set());
  if (slots.length < 2) return null;
  const stored = await Promise.all(
    slots.map(async (slot) => {
      try {
        return (await hasVideoMedia(segmentMediaKey(job.id, slot.index))) ? slot.index : null;
      } catch (error) {
        console.error("Could not check a filmed shot", { jobId: job.id, index: slot.index, error });
        return null;
      }
    }),
  );
  return stored.filter((index): index is number => index != null);
};

export const getVideoJobForUser = async (userId: string, jobId: string): Promise<VideoJobView | null> => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return null;
  const ready = await filmingPreviewIndexes(job);
  const readyByJob = ready ? new Map<string, readonly number[]>([[job.id, ready]]) : undefined;
  const [view] = await viewsFor(userId, [job], readyByJob);
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
  readyIndexes?: readonly number[],
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
    needsModel: job.status === "paused" && isModelChoice(job.errorDetail),
    stalled: isFilmingStalled(job.status, job.heartbeatAt),
    songUrl: readStoredSong(job.artifacts) ? `/api/videos/${job.id}/song` : null,
    clips: readyIndexes ? clipPreviewSlots(job.artifacts, input, new Set(readyIndexes)) : [],
    details: jobDetailRows({ ...input, presetName, characterName }),
  };
};
