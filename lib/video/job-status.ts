/**
 * Legal status moves for a video job. Call this before any write.
 * queued → running → succeeded | failed | paused, and queued | running | paused → canceled.
 * paused → running resumes the clips that were not filmed.
 */

import type { ClipPreviewSlot } from "./clip-preview";
import { MAX_LYRICS_NOTE, MAX_LYRICS_REFERENCES, MAX_REFERENCE_IMAGES } from "./schema";
import { MAX_CUTS, type SongCut } from "@/lib/music/song-plan";
import {
  emptyPromptBrief,
  isAttachmentRole,
  sanitizePromptBrief,
  type AttachmentAssignment,
  type PromptBrief,
} from "./shot-plan";

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
  /** The model failed three times. Filming waits until the person picks another. */
  needsModel: boolean;
  /** Running, but no worker has touched it recently. The progress check tries again. */
  stalled: boolean;
  /** The composed song of a lyrics video, playable once it is written. */
  songUrl: string | null;
  /** Shots already stored while filming. Empty before then, and for a single clip. */
  clips: ClipPreviewSlot[];
  details: JobDetailRow[];
}

const VIDEO_FORMATS = ["9:16", "1:1", "16:9"] as const;

export interface JobInputFields {
  prompt: string;
  format: string;
  length: number;
  model: string;
  mode: string;
  /** Catalog tool the form was opened with. Empty when it was just the mode. */
  tool: string;
  /** `stills` when pictures are drawn and animated, `loop` for a background clip. Empty when the video is filmed. */
  media: string;
  /** The quick edit an edit job makes, and its setting. */
  op: string;
  opValue: string;
  /** Built-in clip behind a loop video. */
  backgroundId: string;
  /** The person's own clip behind a loop video. */
  backgroundKey: string;
  /** The script is read word for word. */
  verbatim: boolean;
  /** The page the script text was read from. Empty when it was typed or pasted. */
  sourceUrl: string;
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
  /** Spoken lines. Empty when the job did not name any. `none` means no voiceover. */
  vo: string;
  /** On-screen cuts. Empty for modes that do not plan shots, and for older jobs. */
  cuts: SongCut[];
  /** Clips the person chose for a stitched video. 0 means the fewest the model needs. */
  clips: number;
  /** How a prompt video was divided. Empty outside prompt videos. */
  brief: PromptBrief;
  attachmentRoles: AttachmentAssignment[];
}

const EMPTY_JOB_INPUT: JobInputFields = {
  prompt: "Untitled video",
  format: "9:16",
  length: 0,
  model: "",
  mode: "",
  tool: "",
  media: "",
  op: "",
  opValue: "",
  backgroundId: "",
  backgroundKey: "",
  verbatim: false,
  sourceUrl: "",
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
  vo: "",
  cuts: [],
  clips: 0,
  brief: emptyPromptBrief(),
  attachmentRoles: [],
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
  const tool = typeof record.tool === "string" ? record.tool : "";
  const media = record.media === "stills" || record.media === "loop" ? record.media : "";
  const op = typeof record.op === "string" ? record.op : "";
  const opValue = typeof record.opValue === "string" ? record.opValue.slice(0, 20) : "";
  const backgroundId = typeof record.backgroundId === "string" ? record.backgroundId : "";
  const backgroundKey = typeof record.backgroundKey === "string" ? record.backgroundKey : "";
  const verbatim = record.verbatim === true;
  const sourceUrl = typeof record.sourceUrl === "string" ? record.sourceUrl.slice(0, 2000) : "";
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
  const clips = typeof record.clips === "number" && Number.isInteger(record.clips) && record.clips > 0 ? record.clips : 0;
  const vo = typeof record.vo === "string" ? record.vo.trim().slice(0, 2000) : "";
  const note = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_LYRICS_NOTE) : "");
  const pictureKeys = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
          .slice(0, MAX_LYRICS_REFERENCES)
      : [];
  const cuts = (value: unknown): SongCut[] => {
    if (!Array.isArray(value)) return [];
    const parsed: SongCut[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const cut = item as Record<string, unknown>;
      if (typeof cut.seconds !== "number" || !Number.isInteger(cut.seconds) || cut.seconds < 1) continue;
      parsed.push({
        seconds: cut.seconds,
        camera: typeof cut.camera === "string" ? cut.camera.trim().slice(0, 200) : "",
        ...(typeof cut.action === "string" && cut.action.trim() ? { action: cut.action.trim().slice(0, 400) } : {}),
        ...(typeof cut.samePlace === "boolean" ? { samePlace: cut.samePlace } : {}),
        ...readCutImages(cut.images),
      });
      if (parsed.length >= MAX_CUTS) break;
    }
    return parsed;
  };
  return {
    prompt,
    format,
    length,
    model,
    mode,
    tool,
    media,
    op,
    opValue,
    backgroundId,
    backgroundKey,
    verbatim,
    sourceUrl,
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
    vo,
    cuts: cuts(record.cuts),
    clips,
    brief: readBrief(record.brief),
    attachmentRoles: readAttachmentRoles(record.attachmentRoles),
  };
};

const readCutImages = (value: unknown) => {
  if (!Array.isArray(value)) return {};
  const images = value
    .filter((index): index is number => typeof index === "number" && Number.isInteger(index) && index >= 1)
    .slice(0, MAX_REFERENCE_IMAGES);
  return images.length > 0 ? { images } : {};
};

const readBrief = (value: unknown): PromptBrief => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyPromptBrief();
  const brief = value as Record<string, unknown>;
  return sanitizePromptBrief({
    subject: typeof brief.subject === "string" ? brief.subject : "",
    setting: typeof brief.setting === "string" ? brief.setting : "",
    director: typeof brief.director === "string" ? brief.director : "",
    style: typeof brief.style === "string" ? brief.style : "",
    mustKeep: typeof brief.mustKeep === "string" ? brief.mustKeep : "",
    mustAvoid: typeof brief.mustAvoid === "string" ? brief.mustAvoid : "",
  });
};

const readAttachmentRoles = (value: unknown): AttachmentAssignment[] => {
  if (!Array.isArray(value)) return [];
  const roles: AttachmentAssignment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = item as Record<string, unknown>;
    if (typeof role.index !== "number" || !Number.isInteger(role.index) || role.index < 1) continue;
    if (typeof role.role !== "string" || !isAttachmentRole(role.role)) continue;
    roles.push({ index: role.index, role: role.role });
    if (roles.length >= MAX_REFERENCE_IMAGES) break;
  }
  return roles;
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
/** A running job with no worker touch for this long is not actually filming. */
export const FILMING_STALL_MS = 2 * 60 * 1000;

export const isFilmingStalled = (status: string, heartbeatAt: Date | null, now = Date.now()) => {
  if (status !== "running") return false;
  if (!heartbeatAt) return true;
  return now - heartbeatAt.getTime() > FILMING_STALL_MS;
};

export const progressFor = (step: JobStep, clipsDone = 0, clipsTotal = 1) => {
  if (step === "script") return 10;
  if (step === "images") return 40;
  if (step === "render") return 98;
  if (step === "finalize") return 100;
  const total = Math.max(clipsTotal, 1);
  const done = Math.min(Math.max(clipsDone, 0), total);
  return Math.round(40 + (45 * done) / total);
};
