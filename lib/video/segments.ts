import { clipDuration } from "./models";

export const STITCHED_MODES = ["prompt", "voiceover", "lyrics", "image"] as const;
export type StitchedMode = (typeof STITCHED_MODES)[number];

const TARGET_CLIP_SECONDS = 7;
const MIN_CLIP_SECONDS = 5;

/** Prompt, Voiceover, Lyrics, Image, and older jobs that never stored a mode. */
export const isStitchedMode = (mode?: string | null) =>
  !mode || (STITCHED_MODES as readonly string[]).includes(mode);

export interface StitchPlan {
  segments: number[];
  beats: string[];
}

/**
 * Fewest clips that cover `length`, each 5–7 seconds when that fits.
 * 13 → [7, 6], 16 → [6, 5, 5], 8 → [8]. Each part is then snapped to a
 * duration the model accepts, so a 2s request on a 5s-minimum model becomes [5].
 */
export const planSegments = (length: number, allowedDurations: readonly number[]) => {
  const seconds = Math.max(0, Math.round(length));
  if (seconds <= 0) return [];
  if (seconds < MIN_CLIP_SECONDS) return [clipDuration(seconds, allowedDurations)];

  let count = Math.ceil(seconds / TARGET_CLIP_SECONDS);
  let parts = splitNearEqual(seconds, count);
  if (Math.min(...parts) < MIN_CLIP_SECONDS) {
    count = Math.max(1, count - 1);
    parts = count === 1 ? [seconds] : splitNearEqual(seconds, count);
  }
  return parts.map((part) => clipDuration(part, allowedDurations));
};

export const filmedSeconds = (length: number, allowedDurations: readonly number[]) =>
  planSegments(length, allowedDurations).reduce((sum, part) => sum + part, 0);

export const segmentMediaKey = (jobId: string, index: number) => `${jobId}.seg-${index}.mp4`;

export const formatClipSplit = (segments: readonly number[]) => {
  if (segments.length <= 1) return "";
  return `Filmed as ${segments.length} clips · ${segments.map((part) => `${part}s`).join(" + ")}`;
};

export const readStitchPlan = (artifacts: unknown): StitchPlan | null => {
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return null;
  const record = artifacts as Record<string, unknown>;
  if (!Array.isArray(record.segments) || !Array.isArray(record.beats)) return null;
  if (record.segments.length < 2 || record.segments.length !== record.beats.length) return null;
  if (!record.segments.every((part) => typeof part === "number" && Number.isInteger(part) && part > 0)) {
    return null;
  }
  if (!record.beats.every((beat) => typeof beat === "string" && beat.trim().length > 0)) return null;
  return {
    segments: record.segments,
    beats: record.beats,
  };
};

const splitNearEqual = (total: number, count: number) => {
  const base = Math.floor(total / count);
  const extra = total % count;
  return Array.from({ length: count }, (_, index) => (index < extra ? base + 1 : base));
};
