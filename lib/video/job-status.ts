/**
 * Legal status moves for a video job. Call this before any write.
 * queued → running → succeeded | failed | paused, and queued | running | paused → canceled.
 * paused → running resumes the clips that were not filmed.
 */

import { MAX_LYRICS_NOTE, MAX_LYRICS_REFERENCES } from "./schema";

export const JOB_STATUSES = ["queued", "running", "paused", "succeeded", "failed", "canceled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STEPS = ["script", "images", "videos", "render", "finalize"] as const;
export type JobStep = (typeof JOB_STEPS)[number];

const ALLOWED: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["running", "canceled"],
  running: ["succeeded", "failed", "canceled", "paused"],
  paused: ["running", "canceled"],
  succeeded: [],
  failed: ["running"],
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

export interface JobDetailRow {
  group: "Tool" | "This video";
  label: string;
  value: string;
}

/** What the browser is allowed to see. Provider URLs stay in the database. */
export interface VideoJobView {
  id: string;
  status: JobStatus;
  currentStep: JobStep | null;
  progressPct: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
  /** Changes when the saved cut is replaced, so the player does not keep an older file. */
  updatedAt: string;
  /** When the job moved to running. Null while it is still queued. */
  startedAt: string | null;
  prompt: string;
  format: string;
  length: number;
  model: string;
  mode: string;
  tier: string;
  resolution: string;
  presetId: string;
  /** Built-in style name, or the saved preset name when this user owns it. */
  presetName: string;
  visualDirection: string;
  characterId: string;
  characterName: string;
  showText: boolean;
  referenceCount: number;
  /** 1-based clip being filmed, when this job is running the filming step and has more than one clip. */
  clipIndex: number | null;
  clipTotal: number;
  /** Clips already stored. A paused job stopped after this many. */
  clipsDone: number;
  /** Finish the open clip, then stop before the next one. */
  stopping: boolean;
  /** The composed song of a lyrics video, playable once it is written. */
  songUrl: string | null;
  details: JobDetailRow[];
}

const VIDEO_FORMATS = ["9:16", "1:1", "16:9"] as const;

export interface JobInputFields {
  prompt: string;
  format: string;
  length: number;
  model: string;
  mode: string;
  tier: string;
  resolution: string;
  imageKey: string;
  mediaKey: string;
  referenceKeys: string[];
  showText: boolean;
  projectId: string;
  presetId: string;
  visualDirection: string;
  characterId: string;
  /** Camera, pacing, and performance notes. Empty outside lyrics videos. */
  direction: string;
  /** Location, set, and wardrobe. Empty outside lyrics videos. */
  scene: string;
  directionKeys: string[];
  sceneKeys: string[];
  /** Song take approved on the create page. Empty when the job composes its own. */
  songId: string;
}

const EMPTY_JOB_INPUT: JobInputFields = {
  prompt: "Untitled video",
  format: "9:16",
  length: 0,
  model: "",
  mode: "",
  tier: "",
  resolution: "",
  imageKey: "",
  mediaKey: "",
  referenceKeys: [],
  showText: true,
  projectId: "",
  presetId: "",
  visualDirection: "",
  characterId: "",
  direction: "",
  scene: "",
  directionKeys: [],
  sceneKeys: [],
  songId: "",
};

/** Prompt and settings stored on the job, with safe fallbacks for a bad payload. */
export const readJobInput = (input: unknown): JobInputFields => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_JOB_INPUT;
  }
  const record = input as Record<string, unknown>;
  const prompt =
    typeof record.prompt === "string" && record.prompt.trim() ? record.prompt.trim() : "Untitled video";
  const format = (VIDEO_FORMATS as readonly string[]).includes(String(record.aspectRatio))
    ? String(record.aspectRatio)
    : "9:16";
  const length = typeof record.duration === "number" && Number.isInteger(record.duration) ? record.duration : 0;
  const model = typeof record.model === "string" ? record.model : "";
  const mode = typeof record.mode === "string" ? record.mode : "";
  const tier = typeof record.tier === "string" ? record.tier : "";
  const resolution = typeof record.resolution === "string" ? record.resolution : "";
  const imageKey = typeof record.imageKey === "string" ? record.imageKey : "";
  const mediaKey =
    typeof record.mediaKey === "string" && record.mediaKey
      ? record.mediaKey
      : imageKey;
  const referenceKeys = Array.isArray(record.referenceKeys)
    ? record.referenceKeys.filter((key): key is string => typeof key === "string" && key.trim().length > 0)
    : typeof record.referenceKey === "string" && record.referenceKey.trim()
      ? [record.referenceKey]
      : [];
  const showText = record.showText !== false;
  const projectId = typeof record.projectId === "string" ? record.projectId : "";
  const presetId = typeof record.presetId === "string" ? record.presetId : typeof record.style === "string" ? record.style : "";
  const visualDirection = typeof record.visualDirection === "string" ? record.visualDirection : "";
  const characterId =
    typeof record.characterId === "string" && record.characterId
      ? record.characterId
      : typeof record.voiceSettingId === "string"
        ? record.voiceSettingId
        : "";
  const songId = typeof record.songId === "string" ? record.songId : "";
  const note = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_LYRICS_NOTE) : "");
  const pictureKeys = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
          .slice(0, MAX_LYRICS_REFERENCES)
      : [];
  return {
    prompt,
    format,
    length,
    model,
    mode,
    tier,
    resolution,
    imageKey,
    mediaKey,
    referenceKeys,
    showText,
    projectId,
    presetId,
    visualDirection,
    characterId,
    direction: note(record.direction),
    scene: note(record.scene),
    directionKeys: pictureKeys(record.directionKeys),
    sceneKeys: pictureKeys(record.sceneKeys),
    songId,
  };
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
