import { clipDuration } from "./models";

export const STITCHED_MODES = ["prompt", "voiceover", "lyrics", "image"] as const;
export type StitchedMode = (typeof STITCHED_MODES)[number];

/** Prompt, Voiceover, Lyrics, Image, and older jobs that never stored a mode. */
export const isStitchedMode = (mode?: string | null) =>
  !mode || (STITCHED_MODES as readonly string[]).includes(mode);

export interface StitchPlan {
  segments: number[];
  beats: string[];
}

/**
 * One clip for the whole length when the model can film it.
 * A longer request is split into the fewest clips that fit the model's maximum.
 * Each part is snapped to a duration the model accepts, so a 2s request on a
 * 5s-minimum model becomes [5].
 */
export const planSegments = (length: number, allowedDurations: readonly number[]) => {
  const seconds = Math.max(0, Math.round(length));
  if (seconds <= 0) return [];
  const max = allowedDurations.length > 0 ? Math.max(...allowedDurations) : seconds;
  if (seconds <= max) return [clipDuration(seconds, allowedDurations)];
  const count = Math.ceil(seconds / max);
  return splitNearEqual(seconds, count).map((part) => clipDuration(part, allowedDurations));
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
