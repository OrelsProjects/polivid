/**
 * Cutting an uploaded video, Loom style: the video is a row of sections that cover it end to end, and each
 * is kept or removed. Splitting makes a new edge; trimming moves the first or last edge; dragging an edge
 * moves the cut between two sections. What is kept, in order, becomes the video.
 */

export interface ClipRange {
  start: number;
  end: number;
}

export interface ClipSection extends ClipRange {
  removed: boolean;
}

/** A section shorter than this is not made; an edge can't be dragged closer than this to another. */
export const MIN_SECTION_SECONDS = 0.2;
/** At most this many kept ranges are sent. */
export const MAX_CLIP_RANGES = 20;

const round = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The whole video, kept. */
export const wholeClip = (duration: number): ClipSection[] => [{ start: 0, end: round(duration), removed: false }];

/** Joins neighbours that are both kept or both removed, and drops slivers. */
export const normalizeSections = (sections: readonly ClipSection[]): ClipSection[] => {
  const merged: ClipSection[] = [];
  for (const section of sections) {
    if (section.end - section.start < 0.001) continue;
    const last = merged[merged.length - 1];
    if (last && last.removed === section.removed) last.end = section.end;
    else merged.push({ ...section });
  }
  return merged;
};

/** Splits the section under `time` in two. Does nothing too close to an existing edge. */
export const splitAt = (sections: readonly ClipSection[], time: number): ClipSection[] => {
  const index = sections.findIndex((section) => time > section.start && time < section.end);
  if (index === -1) return [...sections];
  const section = sections[index]!;
  if (time - section.start < MIN_SECTION_SECONDS || section.end - time < MIN_SECTION_SECONDS) return [...sections];
  const at = round(time);
  return [...sections.slice(0, index), { ...section, end: at }, { ...section, start: at }, ...sections.slice(index + 1)];
};

/** Removes a kept section, or brings a removed one back. At least one section always stays kept. */
export const toggleSection = (sections: readonly ClipSection[], index: number): ClipSection[] => {
  const section = sections[index];
  if (!section) return [...sections];
  if (!section.removed && sections.filter((item) => !item.removed).length === 1) return [...sections];
  return normalizeSections(sections.map((item, at) => (at === index ? { ...item, removed: !item.removed } : item)));
};

/** Moves the edge between section `index` and the next one, keeping both at least MIN_SECTION_SECONDS long. */
export const moveEdge = (sections: readonly ClipSection[], index: number, time: number): ClipSection[] => {
  const left = sections[index];
  const right = sections[index + 1];
  if (!left || !right) return [...sections];
  const at = round(clamp(time, left.start + MIN_SECTION_SECONDS, right.end - MIN_SECTION_SECONDS));
  return sections.map((item, position) =>
    position === index ? { ...item, end: at } : position === index + 1 ? { ...item, start: at } : item,
  );
};

/**
 * Moves the start (or end) of what is kept to `time`. Everything before the start (after the end) is
 * removed; dragging it outwards brings that stretch back. It can't pass the far edge of the first (last)
 * kept part, so something always stays kept.
 */
export const trimTo = (sections: readonly ClipSection[], side: "start" | "end", time: number): ClipSection[] => {
  const kept = keptRanges(sections);
  if (kept.length === 0 || sections.length === 0) return [...sections];
  const duration = sections[sections.length - 1]!.end;
  const first = kept[0]!;
  const last = kept[kept.length - 1]!;
  const at = round(side === "start" ? clamp(time, 0, first.end - MIN_SECTION_SECONDS) : clamp(time, last.start + MIN_SECTION_SECONDS, duration));
  // A cut exactly at the edge, even closer than a normal split allows.
  const index = sections.findIndex((section) => at > section.start && at < section.end);
  const split =
    index === -1
      ? [...sections]
      : [...sections.slice(0, index), { ...sections[index]!, end: at }, { ...sections[index]!, start: at }, ...sections.slice(index + 1)];
  return normalizeSections(
    split.map((section) => {
      if (side === "start") {
        if (section.end <= at + 0.0005) return { ...section, removed: true };
        if (section.end <= first.start + 0.0005) return { ...section, removed: false };
      } else {
        if (section.start >= at - 0.0005) return { ...section, removed: true };
        if (section.start >= last.end - 0.0005) return { ...section, removed: false };
      }
      return section;
    }),
  );
};

/** The kept parts, in order, with neighbours joined. */
export const keptRanges = (sections: readonly ClipSection[]): ClipRange[] =>
  normalizeSections(sections)
    .filter((section) => !section.removed)
    .map(({ start, end }) => ({ start: round(start), end: round(end) }));

export const keptSeconds = (ranges: readonly ClipRange[]) => round(ranges.reduce((sum, range) => sum + (range.end - range.start), 0));

/** Sections for saved kept ranges, so the editor opens where the person left it. */
export const sectionsFromRanges = (ranges: readonly ClipRange[], duration: number): ClipSection[] => {
  const sections: ClipSection[] = [];
  let at = 0;
  for (const range of ranges) {
    if (range.start > at) sections.push({ start: at, end: range.start, removed: true });
    sections.push({ start: range.start, end: range.end, removed: false });
    at = range.end;
  }
  if (duration > at) sections.push({ start: at, end: round(duration), removed: true });
  return normalizeSections(sections);
};

/** True when the ranges keep the whole video, so there is nothing to cut. */
export const keepsEverything = (ranges: readonly ClipRange[], duration: number) =>
  ranges.length === 1 && ranges[0]!.start <= 0.05 && ranges[0]!.end >= duration - 0.05;

/**
 * Where playback should be for a source time: inside a kept range it stays; inside a removed part it jumps
 * to the next kept start; past the last kept range it is done (null).
 */
export const playbackTime = (ranges: readonly ClipRange[], time: number): number | null => {
  for (const range of ranges) {
    if (time < range.start - 0.01) return range.start;
    if (time < range.end - 0.02) return time;
  }
  return null;
};

/** Seconds into the cut video that a source time lands on, for the "0:04 / 0:08" readout. */
export const cutTimeAt = (ranges: readonly ClipRange[], time: number) => {
  let before = 0;
  for (const range of ranges) {
    if (time <= range.start) return round(before);
    if (time < range.end) return round(before + time - range.start);
    before += range.end - range.start;
  }
  return round(before);
};

/**
 * Why these kept ranges can't be used on a video this long, or null. They must be in order, not overlap,
 * stay inside the video, and add up to between `minSeconds` and `maxSeconds`.
 */
export const clipRangesProblem = (ranges: readonly ClipRange[], duration: number, minSeconds: number, maxSeconds: number) => {
  if (ranges.length === 0) return "Keep at least part of the video.";
  if (ranges.length > MAX_CLIP_RANGES) return `Keep at most ${MAX_CLIP_RANGES} parts of the video.`;
  let previousEnd = -1;
  for (const range of ranges) {
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start < 0 || range.end <= range.start) {
      return "One of the kept parts isn't a valid stretch of the video.";
    }
    if (range.start < previousEnd - 0.001) return "The kept parts overlap or are out of order.";
    if (range.end > duration + 0.25) return "A kept part runs past the end of the video.";
    previousEnd = range.end;
  }
  const seconds = keptSeconds(ranges);
  if (seconds < minSeconds - 0.05) return `Keep at least ${minSeconds} seconds of the video.`;
  if (seconds > maxSeconds + 0.05) return `Keep at most ${maxSeconds} seconds. You have ${Math.round(seconds * 10) / 10}.`;
  return null;
};

/** "0:07.4" */
export const clipClock = (seconds: number) => {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
};
