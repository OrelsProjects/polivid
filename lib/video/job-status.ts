/**
 * Legal status moves for a video job. Call this before any write.
 * queued → running → succeeded | failed, and queued | running → canceled.
 */

export const JOB_STATUSES = ["queued", "running", "succeeded", "failed", "canceled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STEPS = ["script", "images", "videos", "render", "finalize"] as const;
export type JobStep = (typeof JOB_STEPS)[number];

const ALLOWED: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["running", "canceled"],
  running: ["succeeded", "failed", "canceled"],
  succeeded: [],
  failed: [],
  canceled: [],
};

export class JobTransitionError extends Error {
  constructor(
    readonly from: JobStatus,
    readonly to: JobStatus,
  ) {
    super(`Cannot move a video job from ${from} to ${to}.`);
    this.name = "JobTransitionError";
  }
}

export const isJobStatus = (value: string): value is JobStatus =>
  (JOB_STATUSES as readonly string[]).includes(value);

export const isJobStep = (value: string | null | undefined): value is JobStep =>
  typeof value === "string" && (JOB_STEPS as readonly string[]).includes(value);

/** Throws when `from → to` is not one of the allowed moves. */
export const assertJobTransition = (from: JobStatus, to: JobStatus) => {
  if (!ALLOWED[from].includes(to)) throw new JobTransitionError(from, to);
};

/** What the browser is allowed to see. Provider URLs stay in the database. */
export interface VideoJobView {
  id: string;
  status: JobStatus;
  currentStep: JobStep | null;
  progressPct: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
  prompt: string;
  format: string;
  length: number;
}

const VIDEO_FORMATS = ["9:16", "1:1", "16:9"] as const;

/** Prompt and settings stored on the job, with safe fallbacks for a bad payload. */
export const readJobInput = (input: unknown): { prompt: string; format: string; length: number; model: string } => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { prompt: "Untitled video", format: "9:16", length: 0, model: "" };
  }
  const record = input as Record<string, unknown>;
  const prompt =
    typeof record.prompt === "string" && record.prompt.trim() ? record.prompt.trim() : "Untitled video";
  const format = (VIDEO_FORMATS as readonly string[]).includes(String(record.aspectRatio))
    ? String(record.aspectRatio)
    : "9:16";
  const length = typeof record.duration === "number" && Number.isInteger(record.duration) ? record.duration : 0;
  const model = typeof record.model === "string" ? record.model : "";
  return { prompt, format, length, model };
};

/**
 * A step is complete once progress has entered the next step's band.
 * Sitting on a later step below that band means the earlier step was skipped.
 */
export const stepIsComplete = (step: JobStep, current: JobStep | null, progressPct: number) => {
  if (!current) return false;
  const stepIndex = JOB_STEPS.indexOf(step);
  const currentIndex = JOB_STEPS.indexOf(current);
  if (currentIndex <= stepIndex) return false;
  const next = JOB_STEPS[stepIndex + 1];
  return progressPct >= (next ? progressFor(next) : 100);
};
export const CREDITS_HELD_ON_SUBMIT = 0;

/** Progress band for a step. Within videos, pass how many clips are already stored. */
export const progressFor = (step: JobStep, clipsDone = 0, clipsTotal = 1) => {
  if (step === "script") return 10;
  if (step === "images") return 40;
  if (step === "render") return 98;
  if (step === "finalize") return 100;
  const total = Math.max(clipsTotal, 1);
  const done = Math.min(Math.max(clipsDone, 0), total);
  return Math.round(40 + (45 * done) / total);
};
