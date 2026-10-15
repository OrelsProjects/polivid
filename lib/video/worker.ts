import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { db } from "@/lib/db";
import { getProjectForUser } from "@/lib/editor/projects";
import { renderEditProject } from "@/lib/editor/render";
import { timelineDurationInFrames } from "@/lib/editor/schema";
import { createVideo } from "@/lib/videos";
import { DEMO_FACTS, DEMO_PLAN, DEMO_QUOTES } from "./demo";
import { finishFootage, footageErrorMessage, FootageStopped, renderFootage, saveFootage } from "./footage";
import { progressFor, readJobInput } from "./job-status";
import { markVideoJobProgress, transitionVideoJob } from "./jobs";
import { footageFromPrepared, prepareModeJob } from "./mode-prepare";
import { clipDuration, generationModelBySlug, isVideoProvider, type VideoProvider } from "./models";
import { modeNeedsUpload, videoModeById } from "./modes";
import { buildScenePlan, normalizePlan, runResearch, writeScript } from "./pipeline";
import { FPS, VIDEO_FORMATS, type ScenePlan, type VideoFormat, type VideoRecord } from "./schema";

/** One under the images band, so skipped script and image steps stay unchecked. */
const FILMING_PROGRESS = progressFor("images") - 1;

interface JobInput {
  prompt: string;
  format: VideoFormat;
  length: number;
  model: string;
  mode?: string;
  tier?: string;
  resolution?: string;
  mediaKey?: string;
  referenceKeys?: string[];
  showText?: boolean;
  projectId?: string;
}

/** One promise per video, so several can film at once. Kept here so a finished request does not drop a long render. */
const runs = new Map<string, Promise<void>>();

const track = (jobId: string, run: Promise<void>) => {
  const existing = runs.get(jobId);
  if (existing) return existing;
  const wrapped = run.finally(() => {
    if (runs.get(jobId) === wrapped) runs.delete(jobId);
  });
  runs.set(jobId, wrapped);
  return wrapped;
};

/** Starts this video now. A video this process is already filming is left alone. */
export const startVideoJob = (userId: string, jobId: string) => {
  const existing = runs.get(jobId);
  if (existing) return existing;
  return track(jobId, filmQueuedJob(userId, jobId));
};

/**
 * Starts every open video this process is not already filming.
 * A video OpenRouter already accepted is polled. One that never left is submitted.
 */
export const resumeOpenVideos = async (userId: string) => {
  const jobs = await db.videoJob.findMany({
    where: { userId, status: { in: ["queued", "running"] } },
    include: { providerJobs: { orderBy: { createdAt: "desc" } } },
  });
  for (const job of jobs) {
    if (runs.has(job.id)) continue;
    const provider = job.providerJobs.find((row) => row.status === "in_progress" || row.status === "pending");
    if (job.status === "running" && provider) {
      track(job.id, finishKnownFootage(userId, job.id, provider.providerJobId, provider.provider));
      continue;
    }
    if (job.status === "running") {
      track(job.id, filmRunningJob(userId, job.id));
      continue;
    }
    track(job.id, filmQueuedJob(userId, job.id));
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
    const mode = input.mode ? videoModeById(input.mode) : null;
    if (mode && modeNeedsUpload(mode) && !input.mediaKey) {
      throw new Error("Upload a file for this mode.");
    }

    if (input.mode === "editor-export") {
      await filmEditorExport(userId, jobId, toJobInput(input));
    } else if (!hasOpenRouterKey()) {
      await filmDemo(userId, jobId, toJobInput(input));
    } else if (input.mode === "motion-graphics") {
      await filmMotion(userId, jobId, toJobInput(input));
    } else {
      await filmWithModel(userId, jobId, toJobInput(input));
    }
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (leaveRunningOnSilence(jobId, error)) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = footageErrorMessage(error);
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
    if (input.mode === "editor-export") {
      await filmEditorExport(userId, jobId, toJobInput(input));
      return;
    }
    if (!hasOpenRouterKey()) {
      await filmDemo(userId, jobId, toJobInput(input));
      return;
    }
    if (input.mode === "motion-graphics") {
      await filmMotion(userId, jobId, toJobInput(input));
      return;
    }
    await filmWithModel(userId, jobId, toJobInput(input));
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (leaveRunningOnSilence(jobId, error)) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = footageErrorMessage(error);
    await saveFailedVideo(userId, jobId, input, message);
    await transitionVideoJob(jobId, "failed", { error: message });
  }
};

const filmEditorExport = async (userId: string, jobId: string, input: JobInput) => {
  if (!input.projectId) throw new Error("This export is missing its edit.");
  const project = await getProjectForUser(userId, input.projectId);
  if (!project) throw new Error("That edit was not found.");
  if (!(await markVideoJobProgress(jobId, "render", 10))) return;
  await renderEditProject(userId, jobId, project.timeline);
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();
  const length = Math.max(2, Math.round(timelineDurationInFrames(project.timeline) / FPS));
  const plan = footagePlan(project.title, length, project.title);
  await createVideo(userId, {
    ...readyRecord(jobId, { ...input, length }, plan, length, false),
    title: project.title,
    parentVideoId: project.sourceVideoId,
    editProjectId: project.id,
  });
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", {
    outputUrl: `/api/videos/${jobId}/file`,
    error: null,
  });
};

const filmWithModel = async (userId: string, jobId: string, input: JobInput) => {
  if (!(await markVideoJobProgress(jobId, "script", 10))) return;
  const prepared = await prepareModeJob(userId, input);
  if (prepared.reuseUploadAsFootage && prepared.mediaBytes) {
    await storeClip(userId, jobId, input, input.length, prepared.mediaBytes, prepared.transcript ?? prepared.prompt);
    return;
  }
  if (!(await markVideoJobProgress(jobId, "videos", FILMING_PROGRESS))) return;
  const clip = await renderFootage(
    footageFromPrepared(prepared),
    () => isStillRunning(userId, jobId),
    (providerJobId, provider) => rememberProviderJob(jobId, providerJobId, provider),
  );
  await storeClip(userId, jobId, input, clip.durationSec, clip.bytes, prepared.prompt);
};

const filmMotion = async (userId: string, jobId: string, input: JobInput) => {
  if (!(await markVideoJobProgress(jobId, "script", 10))) return;
  const generateInput = {
    prompt: input.prompt,
    format: input.format,
    length: input.length,
    model: input.model,
  };
  if (input.tier === "ultra") {
    const { research, searchSources } = await runResearch(input.prompt, input.model);
    if (!(await markVideoJobProgress(jobId, "images", 40))) return;
    const { plan, lint } = await buildScenePlan(generateInput, research, searchSources);
    if (lint.errors[0]) throw new Error(lint.errors[0]);
    await createVideo(userId, {
      ...readyRecord(jobId, input, normalizePlan(plan, input.length), input.length, false),
      facts: research.facts,
      quotes: research.quotes,
      searchSources,
      unverifiedFactIds: lint.unverifiedFactIds,
    });
  } else {
    const plan = normalizePlan(await writeScript(generateInput), input.length);
    await createVideo(userId, readyRecord(jobId, input, plan, input.length, false));
  }
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: null, error: null });
};

const finishKnownFootage = async (userId: string, jobId: string, providerJobId: string, provider: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "running") return;
  const input = readJobInput(job.input);
  if (!isFormat(input.format) || !input.model) return;
  const model = generationModelBySlug(input.model);
  if (!model) return;
  try {
    const bytes = await finishFootage(providerJobId, isVideoProvider(provider) ? provider : model.provider, () =>
      isStillRunning(userId, jobId),
    );
    await db.providerJob.update({
      where: { providerJobId },
      data: { status: "completed", lastPolledAt: new Date() },
    });
    await storeClip(userId, jobId, toJobInput(input), clipDuration(input.length, model.durations), bytes);
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (leaveRunningOnSilence(jobId, error)) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = footageErrorMessage(error);
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

const storeClip = async (
  userId: string,
  jobId: string,
  input: JobInput,
  durationSec: number,
  bytes: Uint8Array,
  narration = input.prompt,
) => {
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();
  await saveFootage(jobId, bytes);
  const plan = footagePlan(input.prompt, durationSec, input.showText === false ? "" : narration);
  await createVideo(userId, readyRecord(jobId, input, plan, durationSec, false));
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", {
    outputUrl: `/api/videos/${jobId}/file`,
    error: null,
  });
};

const rememberProviderJob = async (jobId: string, providerJobId: string, provider: VideoProvider) => {
  console.info("Waiting on the video model", { jobId, providerJobId, provider });
  await db.providerJob.deleteMany({ where: { jobId, sceneIdx: 0 } });
  await db.providerJob.create({
    data: { providerJobId, provider, jobId, sceneIdx: 0, status: "in_progress" },
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

/** A dropped connection is not a result. The row stays running so the wait can continue. */
const leaveRunningOnSilence = (jobId: string, error: unknown) => {
  if (!(error instanceof TypeError)) return false;
  if (error.message !== "fetch failed" && error.message !== "terminated") return false;
  console.error("The video model has not replied. Leaving the job running.", { jobId, cause: error.cause });
  return true;
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

const footagePlan = (prompt: string, durationSec: number, narration = prompt): ScenePlan => {
  const title = titleFromPrompt(prompt);
  return {
    title,
    scenes: [
      {
        type: "footage",
        headline: title,
        narration: narration.trim(),
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

const toJobInput = (input: ReturnType<typeof readJobInput>): JobInput => ({
  prompt: input.prompt,
  format: input.format as VideoFormat,
  length: input.length,
  model: input.model,
  mode: input.mode || undefined,
  tier: input.tier || undefined,
  resolution: input.resolution || undefined,
  mediaKey: input.mediaKey || input.imageKey || undefined,
  referenceKeys: input.referenceKeys.length > 0 ? input.referenceKeys : undefined,
  showText: input.showText,
  projectId: input.projectId || undefined,
});
