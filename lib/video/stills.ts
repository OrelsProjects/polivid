/**
 * Animated stills: one generated picture per beat of the script, moved by the camera
 * while a voice reads. Nothing here touches the network, so the form and the server
 * share the same counts and prices.
 */

export const VISUAL_MEDIA = ["video", "stills", "loop"] as const;
export type VisualMedia = (typeof VISUAL_MEDIA)[number];

export const isVisualMedia = (value: unknown): value is VisualMedia =>
  typeof value === "string" && (VISUAL_MEDIA as readonly string[]).includes(value);

/** Stored as the job's model, the way an export stores `editor`. No footage model films these. */
export const STILLS_MODEL = "stills";

export const STILLS_LABEL = "Animated stills";

/** Stored as the job's model when narrated text plays over a looping background clip. */
export const LOOP_MODEL = "loop";
export const LOOP_LABEL = "Background loop";

/** A narrated video made here has no footage model, so its stored model is one of these. */
export const isComposedModel = (model: string | null | undefined) => model === STILLS_MODEL || model === LOOP_MODEL;

/** The longest video each kind of picture can run. Narration over a loop costs little, so it runs longer. */
export const MAX_FILMED_LENGTH = 90;
export const MAX_LOOP_LENGTH = 180;
export const maxLengthForMedia = (media: string | null | undefined) =>
  media === "loop" ? MAX_LOOP_LENGTH : MAX_FILMED_LENGTH;

/** Covers the render of a looped background, which grows with the length. */
export const LOOP_BASE_CREDITS = 8;
export const LOOP_CREDITS_PER_HALF_MINUTE = 2;

/** Words read between two caption timings. Shorter runs keep the captions close to the voice. */
export const LOOP_WORDS_PER_BEAT = 18;
export const loopBeatCount = (words: number) => Math.max(1, Math.min(60, Math.ceil(words / LOOP_WORDS_PER_BEAT)));

/** A picture stays up for about this long. */
export const STILL_SECONDS = 5;
export const MIN_STILLS = 3;
export const MAX_STILLS = 16;

/** Read-aloud pace used to size a script before any speech exists. */
export const WORDS_PER_SECOND = 2.5;

export const STILL_IMAGE_USD = { draft: 0.04, final: 0.08 } as const;
/** Speech is priced by the character. This is that price at a normal reading pace. */
export const SPEECH_USD_PER_SECOND = 0.0005;
/** Covers drawing the frames and encoding the file. */
export const STILLS_RENDER_CREDITS = 5;

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Seconds a script takes to read. */
export const secondsForWords = (words: number) => Math.ceil(Math.max(0, words) / WORDS_PER_SECOND);

/** Pictures a video of this length gets. A script with very few words gets one per word at most. */
export const stillCountFor = (lengthSec: number, words = Number.POSITIVE_INFINITY) => {
  const byLength = Math.min(MAX_STILLS, Math.max(MIN_STILLS, Math.ceil(lengthSec / STILL_SECONDS)));
  return Math.max(1, Math.min(byLength, words));
};

/** Low draws draft pictures. Pro and Ultra draw the final-quality ones. */
export const stillsUseDraft = (tier: string | undefined) => tier === "low";

/**
 * Cuts a script into `count` runs of words, in order, with nothing added or dropped.
 * A cut lands on the end of a sentence when one is near, then on a comma, then mid-sentence.
 */
export const splitScript = (script: string, count: number): string[] => {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const parts = Math.max(1, Math.min(Math.floor(count), words.length));
  if (parts === 1) return [words.join(" ")];
  const target = words.length / parts;
  const reach = Math.max(1, Math.floor(target * 0.4));
  const cuts: number[] = [];
  let previous = 0;
  for (let part = 1; part < parts; part += 1) {
    const ideal = Math.round(part * target);
    // Leave at least one word for this part and one for each part still to come.
    const lowest = previous + 1;
    const highest = words.length - (parts - part);
    const from = Math.max(lowest, ideal - reach);
    const to = Math.min(highest, ideal + reach);
    const pick = (ends: RegExp) => {
      let best = -1;
      for (let index = from; index <= to; index += 1) {
        if (!ends.test(words[index - 1] ?? "")) continue;
        if (best < 0 || Math.abs(index - ideal) < Math.abs(best - ideal)) best = index;
      }
      return best;
    };
    const sentence = pick(/[.!?]["')\]]*$/);
    const clause = sentence >= 0 ? sentence : pick(/[,;:—–]["')\]]*$/);
    const cut = clause >= 0 ? clause : Math.min(highest, Math.max(lowest, ideal));
    cuts.push(cut);
    previous = cut;
  }
  const beats: string[] = [];
  let start = 0;
  for (const cut of [...cuts, words.length]) {
    beats.push(words.slice(start, cut).join(" "));
    start = cut;
  }
  return beats;
};

export const STILL_MOTIONS = ["zoom-in", "pan-left", "zoom-out", "pan-right", "pan-up", "pan-down"] as const;
export type StillMotionKind = (typeof STILL_MOTIONS)[number];

/** Motion for the picture at this position, so neighbours never move the same way. */
export const motionForStill = (index: number): StillMotionKind => {
  const cycle: readonly StillMotionKind[] = ["zoom-in", "pan-left", "zoom-out", "pan-right"];
  return cycle[index % cycle.length] ?? "zoom-in";
};

export interface CaptionChunk {
  text: string;
  /** Frame offset inside the beat. */
  from: number;
  frames: number;
}

/**
 * Splits one spoken beat into short caption lines and spreads them over its frames,
 * giving each line time in proportion to how long it takes to say.
 */
export const captionChunks = (text: string, frames: number, maxWords = 4): CaptionChunk[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const total = Math.max(1, Math.floor(frames));
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line: string[] = [];
  for (const word of words) {
    line.push(word);
    const closes = /[.!?,;:—–]["')\]]*$/.test(word);
    if (line.length >= maxWords || (closes && line.length >= 2)) {
      lines.push(line.join(" "));
      line = [];
    }
  }
  if (line.length > 0) {
    // A single leftover word reads better attached to the line before it.
    if (line.length === 1 && lines.length > 0) lines[lines.length - 1] = `${lines[lines.length - 1]} ${line[0]}`;
    else lines.push(line.join(" "));
  }
  const kept = lines.slice(0, total);
  if (kept.length < lines.length) kept[kept.length - 1] = lines.slice(kept.length - 1).join(" ");
  const weights = kept.map((entry) => entry.length + 1);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const chunks: CaptionChunk[] = [];
  let used = 0;
  let spent = 0;
  kept.forEach((entry, index) => {
    spent += weights[index] ?? 1;
    const end = index === kept.length - 1 ? total : Math.max(used + 1, Math.round((spent / weightSum) * total));
    const stop = Math.min(end, total - (kept.length - 1 - index));
    chunks.push({ text: entry, from: used, frames: Math.max(1, stop - used) });
    used = Math.max(used + 1, stop);
  });
  return chunks;
};
