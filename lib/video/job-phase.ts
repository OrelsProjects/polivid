import type { JobStatus, JobStep } from "./job-status";

/** Colour family of the badge: waiting on nothing yet, preparing, the model working, our own render, or needs a look. */
export type PhaseTone = "idle" | "prep" | "generate" | "render" | "attention";

export interface JobPhase {
  /** Short upper-case word for the card badge. */
  badge: string;
  tone: PhaseTone;
  /** What is happening right now, in one line. */
  headline: string;
  /** Timing or what to expect, or null. */
  detail: string | null;
}

export interface PhaseInput {
  status: JobStatus;
  currentStep: JobStep | null;
  mode: string;
  modelName: string;
  characterName: string;
  clipIndex: number | null;
  clipTotal: number;
  clipsDone: number;
  stopping: boolean;
  needsModel: boolean;
  stalled: boolean;
  /** When the open clip was sent to the video model. */
  clipStartedAt: string | null;
  /** Median seconds this model took for recent clips, or null with too little history. */
  typicalClipSec: number | null;
}

/** "under a minute", "about 1 min", "about 12 min", "about 1 h 20 min". */
export const roughDuration = (seconds: number) => {
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `about ${hours} h ${rest} min` : `about ${hours} h`;
};

/** "45s", "6m 12s", "1h 4m". */
export const shortDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const secs = total % 60;
  return secs ? `${minutes}m ${secs}s` : `${minutes}m`;
};

const FALLBACK_WAIT = "Video models often take 20–30 minutes, and sometimes longer.";

const generatingHeadline = (job: PhaseInput) => {
  const model = job.modelName || "The video model";
  if (job.stopping) {
    return job.clipTotal > 1
      ? `Finishing clip ${job.clipIndex ?? job.clipsDone + 1} of ${job.clipTotal}, then pausing`
      : "Finishing this clip, then pausing";
  }
  if (job.mode === "swap") {
    const who = job.characterName || "the character";
    if (job.clipTotal > 1) return `${model} is putting ${who} into ${job.clipTotal} parts of the video (${job.clipsDone} done)`;
    return job.characterName ? `${model} is putting ${job.characterName} into the video` : `${model} is swapping the character`;
  }
  if (job.mode === "lyrics" && job.clipTotal > 1) return `${model} is generating ${job.clipTotal} clips (${job.clipsDone} done)`;
  if (job.clipIndex && job.clipTotal > 1) return `${model} is generating clip ${job.clipIndex} of ${job.clipTotal}`;
  return `${model} is generating the video`;
};

const generatingDetail = (job: PhaseInput, now: number | null) => {
  const sentAt = job.clipStartedAt ? new Date(job.clipStartedAt).getTime() : NaN;
  const waited = now !== null && !Number.isNaN(sentAt) ? Math.max(0, (now - sentAt) / 1000) : null;
  const parts: string[] = [];
  if (waited !== null) parts.push(`Sent ${shortDuration(waited)} ago.`);
  if (job.typicalClipSec) {
    parts.push(
      waited !== null && waited > job.typicalClipSec * 2
        ? `Taking longer than usual (${roughDuration(job.typicalClipSec)}).`
        : `Usually ${roughDuration(job.typicalClipSec)}.`,
    );
  } else {
    parts.push(FALLBACK_WAIT);
  }
  return parts.join(" ");
};

/** What a running, queued, or paused job is doing, worded for the person waiting on it. */
export const jobPhase = (job: PhaseInput, now: number | null): JobPhase => {
  if (job.status === "queued") return { badge: "QUEUED", tone: "idle", headline: "Waiting to start", detail: "It starts as soon as a worker is free." };
  if (job.status === "paused") {
    if (job.needsModel) return { badge: "NEEDS A MODEL", tone: "attention", headline: "The model failed three times", detail: "Pick another model to keep going." };
    return { badge: "PAUSED", tone: "idle", headline: `Paused after clip ${job.clipsDone} of ${job.clipTotal}`, detail: "Continue films the rest." };
  }
  if (job.stalled) return { badge: "STALLED", tone: "attention", headline: "No update for a while", detail: "We're checking on it and will pick it back up." };
  switch (job.currentStep) {
    case "script":
      return { badge: "PLANNING", tone: "prep", headline: job.mode === "lyrics" ? "Writing the song" : "Writing the script", detail: null };
    case "images":
      return { badge: "PLANNING", tone: "prep", headline: "Making the frames", detail: null };
    case "videos":
      return { badge: "GENERATING", tone: "generate", headline: generatingHeadline(job), detail: generatingDetail(job, now) };
    case "render":
      if (job.mode === "swap" && job.clipTotal > 1) {
        return {
          badge: "RENDERING",
          tone: "render",
          headline: `Joining the ${job.clipTotal} parts${job.characterName ? ` and giving ${job.characterName} their voice` : ""}`,
          detail: "Every part is swapped. Joining them back into one video takes a minute or two.",
        };
      }
      if (job.mode === "swap") {
        return {
          badge: "RENDERING",
          tone: "render",
          headline: job.characterName ? `Giving ${job.characterName} their voice` : "Putting in the character's voice",
          detail: "The picture is done. The speech is being re-voiced, which takes a minute or two.",
        };
      }
      return {
        badge: "RENDERING",
        tone: "render",
        headline: job.clipTotal > 1 ? `Stitching ${job.clipTotal} clips into one video` : "Rendering the video",
        detail: "The model is done. This part takes a minute or two.",
      };
    case "finalize":
      return { badge: "FINISHING", tone: "render", headline: "Saving your video", detail: "Almost there." };
    default:
      return { badge: "STARTING", tone: "idle", headline: "Starting", detail: null };
  }
};

/** Median of clip durations, or null under three samples. */
export const typicalSeconds = (samples: readonly number[]) => {
  if (samples.length < 3) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
