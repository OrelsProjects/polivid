import type { JobStep } from "./job-status";
import { JOB_STEPS } from "./job-status";
import { generationModelBySlug } from "./models";
import { isStitchedMode, planSegments } from "./segments";

export const STEP_LABEL: Record<JobStep, string> = {
  script: "Writing the script",
  images: "Making the frames",
  videos: "Filming the scenes",
  render: "Stitching the video",
  finalize: "Finishing up",
};

export type StageState = "done" | "current" | "upcoming";

const EDITOR_MODEL = "editor";

/** Stages this job is expected to pass through, in order. */
export const stagesForJob = (job: { mode: string; tier: string; model: string; length: number }): JobStep[] => {
  if (job.model === EDITOR_MODEL) return ["render", "finalize"];
  if (job.mode === "motion-graphics") {
    return job.tier === "ultra" ? ["script", "images", "finalize"] : ["script", "finalize"];
  }
  const steps: JobStep[] = ["script", "videos"];
  if (clipCountForJob(job) > 1) steps.push("render");
  steps.push("finalize");
  return steps;
};

/** How many clips a stitched footage job will film. Other jobs are one clip. */
export const clipCountForJob = (job: { mode: string; model: string; length: number }) => {
  const model = generationModelBySlug(job.model);
  if (!model || !isStitchedMode(job.mode)) return 1;
  return Math.max(planSegments(job.length, model.durations).length, 1);
};

/**
 * 1-based clip being filmed. An open provider clip wins. Otherwise it is the
 * next clip after the ones already stored. One-clip jobs return null.
 */
export const filmingClipIndex = (
  clips: readonly { sceneIdx: number; status: string }[],
  total: number,
): number | null => {
  if (total <= 1) return null;
  const open = clips.filter((clip) => clip.status === "pending" || clip.status === "in_progress");
  if (open.length > 0) return Math.min(total, Math.max(...open.map((clip) => clip.sceneIdx)) + 1);
  const done = new Set(clips.filter((clip) => clip.status === "completed").map((clip) => clip.sceneIdx)).size;
  return Math.min(total, done + 1);
};

/** True when this finished clip should be the last one before a pause. The final clip always completes the video. */
export const shouldHoldAfterClip = (index: number, total: number, stopAfterClip: boolean) =>
  stopAfterClip && index < total - 1;

export const completedClipCount = (clips: readonly { sceneIdx: number; status: string }[]) =>
  new Set(clips.filter((clip) => clip.status === "completed").map((clip) => clip.sceneIdx)).size;

export const clipProgressLabel = (
  index: number | null,
  total: number,
  parallel?: { done?: number },
) => {
  if (total <= 1) return "";
  if (parallel) {
    if (parallel.done === undefined) return `${total} clips`;
    return `${parallel.done} of ${total} clips filmed`;
  }
  if (index) return `Clip ${index} of ${total}`;
  return `${total} clips`;
};

export const stepLabel = (step: JobStep, mode?: string) => {
  if (step === "script" && mode === "lyrics") return "Writing the song";
  return STEP_LABEL[step];
};

/** Expected stages, plus the live step when the job is on one that path usually skips. */
export const visibleStages = (expected: readonly JobStep[], current: JobStep | null): JobStep[] => {
  if (!current || expected.includes(current)) return [...expected];
  const stages = [...expected];
  const at = stages.findIndex((step) => JOB_STEPS.indexOf(step) > JOB_STEPS.indexOf(current));
  stages.splice(at === -1 ? stages.length : at, 0, current);
  return stages;
};

export const stageState = (step: JobStep, stages: readonly JobStep[], current: JobStep | null): StageState => {
  if (step === current) return "current";
  if (!current) return "upcoming";
  const stepIndex = stages.indexOf(step);
  const currentIndex = stages.indexOf(current);
  if (stepIndex === -1 || currentIndex === -1) return "upcoming";
  return stepIndex < currentIndex ? "done" : "upcoming";
};
