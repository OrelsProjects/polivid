import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { db } from "@/lib/db";
import { createVideo } from "@/lib/videos";
import { DEMO_FACTS, DEMO_PLAN, DEMO_QUOTES } from "./demo";
import { finishFootage, FootageStopped, renderFootage, saveFootage } from "./footage";
import { progressFor, readJobInput } from "./job-status";
import { markVideoJobProgress, transitionVideoJob } from "./jobs";
import { clipDuration, generationModelBySlug } from "./models";
import { normalizePlan } from "./pipeline";
import { VIDEO_FORMATS, type ScenePlan, type VideoFormat, type VideoRecord } from "./schema";

/** One under the images band, so skipped script and image steps stay unchecked. */
const FILMING_PROGRESS = progressFor("images") - 1;

interface JobInput {
  prompt: string;
  format: VideoFormat;
  length: number;
  model: string;
}

const runs = new Map<string, Promise<void>>();

export const queuedVideoJobCount = async (userId: string) =>
  db.videoJob.count({ where: { userId, status: "queued" } });

/**
 * Films queued videos and keeps waiting on ones already sent to OpenRouter.
 * One run per user. The promise stays in this Node process, so a finished
 * HTTP request does not abandon a 20–30 minute render.
 */
export const startVideoWorker = (userId: string) => {
  const existing = runs.get(userId);
  if (existing) return existing;
  const run = runVideoWorker(userId).finally(() => {
    if (runs.get(userId) === run) runs.delete(userId);
  });
  runs.set(userId, run);
  return run;
};

const runVideoWorker = async (userId: string) => {
  await resumeFilming(userId);
  const queued = await db.videoJob.findMany({
    where: { userId, status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const job of queued) {
    await filmQueuedJob(userId, job.id);
  }
};

/** A running job whose wait died. If OpenRouter already has an id, keep polling that. Otherwise submit again. */
const resumeFilming = async (userId: string) => {
  const jobs = await db.videoJob.findMany({
    where: { userId, status: "running" },
    include: { providerJobs: { orderBy: { createdAt: "desc" } } },
  });
  for (const job of jobs) {
    const provider = job.providerJobs.find((row) => row.status === "in_progress" || row.status === "pending");
    if (provider) {
      await finishKnownFootage(userId, job.id, provider.providerJobId);
      continue;
    }
    await filmRunningJob(userId, job.id);
  }
};

const filmQueuedJob = async (userId: string, jobId: string) => {
  try {
    await transitionVideoJob(jobId, "running");
  } catch {
    return;
  }

  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "running") return;
  const input = readJobInput(job.input);

  try {
    if (!isFormat(input.format) || !input.model || input.length < 2) {
      throw new Error("This queued video is missing a model, format, or length.");
    }
    const filming = await markVideoJobProgress(jobId, "videos", FILMING_PROGRESS);
    if (!filming) return;

    if (hasOpenRouterKey()) {
      await filmWithModel(userId, jobId, { ...input, format: input.format });
    } else {
      await filmDemo(userId, jobId, { ...input, format: input.format });
    }
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = error instanceof Error ? error.message : "The video didn't finish.";
    await saveFailedVideo(userId, jobId, input, message);
    await transitionVideoJob(jobId, "failed", { error: message });
  }
};

const filmRunningJob = async (userId: string, jobId: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "running") return;
  const input = readJobInput(job.input);
  if (!isFormat(input.format) || !input.model || input.length < 2) return;
  try {
    if (!hasOpenRouterKey()) {
      await filmDemo(userId, jobId, { ...input, format: input.format });
      return;
    }
    await filmWithModel(userId, jobId, { ...input, format: input.format });
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = error instanceof Error ? error.message : "The video didn't finish.";
    await saveFailedVideo(userId, jobId, input, message);
    await transitionVideoJob(jobId, "failed", { error: message });
  }
};

const filmWithModel = async (userId: string, jobId: string, input: JobInput) => {
  const clip = await renderFootage(input, () => isStillRunning(userId, jobId), (providerJobId) =>
    rememberProviderJob(jobId, providerJobId),
  );
  await storeClip(userId, jobId, input, clip.durationSec, clip.bytes);
};

const finishKnownFootage = async (userId: string, jobId: string, providerJobId: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "running") return;
  const input = readJobInput(job.input);
  if (!isFormat(input.format) || !input.model) return;
  const model = generationModelBySlug(input.model);
  if (!model) return;
  try {
    const bytes = await finishFootage(providerJobId, () => isStillRunning(userId, jobId));
    await db.providerJob.update({
      where: { providerJobId },
      data: { status: "completed", lastPolledAt: new Date() },
    });
    await storeClip(userId, jobId, { ...input, format: input.format }, clipDuration(input.length, model.durations), bytes);
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = error instanceof Error ? error.message : "The video didn't finish.";
    await db.providerJob
      .update({
        where: { providerJobId },
        data: { status: "failed", lastPolledAt: new Date() },
      })
      .catch(() => undefined);
    await saveFailedVideo(userId, jobId, input, message);
    await transitionVideoJob(jobId, "failed", { error: message });
  }
};

const storeClip = async (userId: string, jobId: string, input: JobInput, durationSec: number, bytes: Uint8Array) => {
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();
  await saveFootage(jobId, bytes);
  const plan = footagePlan(input.prompt, durationSec);
  await createVideo(userId, readyRecord(jobId, input, plan, durationSec, false));
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", {
    outputUrl: `/api/videos/${jobId}/file`,
    error: null,
  });
};

const rememberProviderJob = async (jobId: string, providerJobId: string) => {
  console.info("Waiting on OpenRouter", { jobId, providerJobId });
  await db.providerJob.deleteMany({ where: { jobId, sceneIdx: 0 } });
  await db.providerJob.create({
    data: { providerJobId, jobId, sceneIdx: 0, status: "in_progress" },
  });
};

const filmDemo = async (userId: string, jobId: string, input: JobInput) => {
  const record: VideoRecord = {
    ...readyRecord(jobId, input, normalizePlan(DEMO_PLAN, input.length), input.length, true),
    title: DEMO_PLAN.title,
    facts: DEMO_FACTS,
    quotes: DEMO_QUOTES,
  };
  await createVideo(userId, record);
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: null, error: null });
};

const saveFailedVideo = async (userId: string, jobId: string, input: ReturnType<typeof readJobInput>, message: string) => {
  const format = isFormat(input.format) ? input.format : "9:16";
  try {
    await createVideo(userId, {
      id: jobId,
      prompt: input.prompt,
      format,
      length: input.length > 0 ? input.length : 2,
      status: "failed",
      createdAt: new Date().toISOString(),
      title: input.prompt.slice(0, 80),
      facts: [],
      quotes: [],
      plan: null,
      searchSources: [],
      unverifiedFactIds: [],
      model: input.model || "unknown",
      demo: !hasOpenRouterKey(),
      error: message,
    });
  } catch (error) {
    console.error("Could not save the failed video", error);
  }
};

const isStillRunning = async (userId: string, jobId: string) => {
  const updated = await db.videoJob.updateMany({
    where: { id: jobId, userId, status: "running" },
    data: { heartbeatAt: new Date() },
  });
  return updated.count === 1;
};

const readyRecord = (
  jobId: string,
  input: JobInput,
  plan: ScenePlan,
  length: number,
  demo: boolean,
): VideoRecord => ({
  id: jobId,
  prompt: input.prompt,
  format: input.format,
  length,
  status: "ready",
  createdAt: new Date().toISOString(),
  title: plan.title,
  facts: [],
  quotes: [],
  plan,
  searchSources: [],
  unverifiedFactIds: [],
  model: input.model,
  demo,
  error: null,
});

const footagePlan = (prompt: string, durationSec: number): ScenePlan => {
  const title = titleFromPrompt(prompt);
  return {
    title,
    scenes: [
      {
        type: "footage",
        headline: title,
        narration: prompt.trim(),
        factIds: [],
        quote: null,
        durationSec,
      },
    ],
  };
};

const titleFromPrompt = (prompt: string) => {
  const trimmed = prompt.trim().replace(/[.?!]+$/g, "");
  const short = trimmed.length > 72 ? `${trimmed.slice(0, 72).trim()}…` : trimmed;
  return short.charAt(0).toUpperCase() + short.slice(1);
};

const isFormat = (value: string): value is VideoFormat => (VIDEO_FORMATS as readonly string[]).includes(value);
