import { MAX_LYRICS_REFERENCES, MAX_SONG_SHOT_IMAGES } from "@/lib/video/schema";
import { clipDuration } from "@/lib/video/models";
import { planSegments } from "@/lib/video/segments";

const MIN_CHUNK_SECONDS = 3;
const MAX_CHUNK_SECONDS = 120;

export interface LyricSection {
  name: string;
  lines: string[];
}

export interface SongSectionPlan extends LyricSection {
  /** Model-legal clip lengths that add up to this section. */
  clips: number[];
  durationSec: number;
}

export interface SongShot {
  index: number;
  startSec: number;
  durationSec: number;
  lines: string[];
  kind: "performance" | "broll";
  sectionName: string;
}

export interface SongWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SongBrief {
  style: string;
  lyrics: string;
}

const TAG = /^\s*\[([^\]\n]{1,100})\]\s*$/;

/** Pull a leading "Style:" line out of a lyrics prompt. The rest is the lyric sheet. */
export const readSongBrief = (prompt: string): SongBrief => {
  const style: string[] = [];
  const lyrics: string[] = [];
  let inLyrics = false;
  for (const line of prompt.split(/\r?\n/)) {
    const trimmed = line.trim();
    const styleMatch = /^style\s*:\s*(.*)$/i.exec(trimmed);
    if (!inLyrics && styleMatch) {
      if (styleMatch[1]) style.push(styleMatch[1]);
      continue;
    }
    if (trimmed) inLyrics = true;
    lyrics.push(line);
  }
  return { style: style.join(", "), lyrics: lyrics.join("\n").trim() };
};

/** Honor [Verse] / [Chorus] tags. Without tags, blank lines separate stanzas. */
export const splitLyricSections = (lyrics: string): LyricSection[] => {
  const rows = lyrics.split(/\r?\n/);
  const hasTags = rows.some((row) => TAG.test(row.trim()));
  if (hasTags) return sectionsFromTags(rows);
  return sectionsFromStanzas(rows);
};

const sectionsFromTags = (rows: string[]): LyricSection[] => {
  const sections: LyricSection[] = [];
  let current: LyricSection | null = null;
  const push = () => {
    if (!current) return;
    const lines = current.lines.map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0) sections.push({ name: current.name, lines });
    current = null;
  };
  for (const row of rows) {
    const match = TAG.exec(row.trim());
    if (match) {
      push();
      current = { name: match[1]!.trim() || "Section", lines: [] };
      continue;
    }
    if (!row.trim()) continue;
    if (!current) current = { name: "Intro", lines: [] };
    current.lines.push(row.trim());
  }
  push();
  return sections;
};

const sectionsFromStanzas = (rows: string[]): LyricSection[] => {
  const stanzas: string[][] = [];
  let current: string[] = [];
  const push = () => {
    if (current.length === 0) return;
    stanzas.push(current);
    current = [];
  };
  for (const row of rows) {
    if (!row.trim()) {
      push();
      continue;
    }
    current.push(row.trim());
  }
  push();
  if (stanzas.length === 0) return [];
  return stanzas.map((lines, index) => ({
    name: stanzas.length === 1 ? "Song" : `Section ${index + 1}`,
    lines,
  }));
};

const durationsAtLeast = (allowed: readonly number[], min: number) => allowed.filter((duration) => duration >= min);

const mergeUntil = (sections: LyricSection[], max: number) => {
  const next = sections.map((section) => ({ name: section.name, lines: [...section.lines] }));
  while (next.length > Math.max(1, max)) {
    let joinAt = 0;
    let smallest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < next.length - 1; index += 1) {
      const weight = next[index]!.lines.length + next[index + 1]!.lines.length;
      if (weight < smallest) {
        smallest = weight;
        joinAt = index;
      }
    }
    const left = next[joinAt]!;
    const right = next[joinAt + 1]!;
    next.splice(joinAt, 2, { name: left.name, lines: [...left.lines, ...right.lines] });
  }
  return next;
};

const assignClips = (sections: LyricSection[], clips: number[]) => {
  const fitted = mergeUntil(sections, clips.length);
  const counts = fitted.map(() => 1);
  let extra = clips.length - fitted.length;
  const weights = fitted.map((section) => Math.max(1, section.lines.length));
  while (extra > 0) {
    let pick = 0;
    let best = -1;
    for (let index = 0; index < fitted.length; index += 1) {
      const score = weights[index]! / counts[index]!;
      if (score > best) {
        best = score;
        pick = index;
      }
    }
    counts[pick] = (counts[pick] ?? 1) + 1;
    extra -= 1;
  }
  let cursor = 0;
  return fitted.map((section, index) => {
    const count = counts[index] ?? 1;
    const part = clips.slice(cursor, cursor + count);
    cursor += count;
    return { name: section.name, lines: section.lines, clips: part };
  });
};

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

const spreadLines = (lines: readonly string[], count: number) => {
  const buckets = Array.from({ length: count }, () => [] as string[]);
  if (count === 0) return buckets;
  lines.forEach((line, index) => {
    const bucket = Math.min(count - 1, Math.floor((index * count) / Math.max(lines.length, 1)));
    buckets[bucket]!.push(line);
  });
  return buckets;
};

/** Keep every ElevenLabs chunk between 3 and 120 seconds by joining or splitting clip groups. */
const fitChunkBounds = (
  groups: { name: string; lines: string[]; clips: number[] }[],
): { name: string; lines: string[]; clips: number[] }[] => {
  const joined = groups.map((group) => ({ ...group, clips: [...group.clips] }));
  let index = 0;
  while (index < joined.length) {
    if (sum(joined[index]!.clips) >= MIN_CHUNK_SECONDS || joined.length === 1) {
      index += 1;
      continue;
    }
    const host = index === 0 ? 1 : index - 1;
    const short = joined[index]!;
    joined[host] = {
      name: index === 0 ? short.name : joined[host]!.name,
      lines: index === 0 ? [...short.lines, ...joined[host]!.lines] : [...joined[host]!.lines, ...short.lines],
      clips: index === 0 ? [...short.clips, ...joined[host]!.clips] : [...joined[host]!.clips, ...short.clips],
    };
    joined.splice(index, 1);
    if (index > 0) index -= 1;
  }
  const bounded: { name: string; lines: string[]; clips: number[] }[] = [];
  for (const group of joined) {
    const buckets: number[][] = [];
    let bucket: number[] = [];
    for (const clip of group.clips) {
      if (bucket.length > 0 && sum(bucket) + clip > MAX_CHUNK_SECONDS) {
        buckets.push(bucket);
        bucket = [];
      }
      bucket.push(clip);
    }
    if (bucket.length > 0) buckets.push(bucket);
    const lines = spreadLines(group.lines, buckets.length);
    buckets.forEach((clips, index) => {
      bounded.push({ name: group.name, lines: lines[index] ?? [], clips });
    });
  }
  return bounded.length > 0 ? bounded : joined;
};

/**
 * Section durations sum to the filmed length. Each section is a run of model-legal clips,
 * and each run is long enough for one ElevenLabs chunk.
 */
export const planSongSections = (
  sections: readonly LyricSection[],
  length: number,
  modelDurations: readonly number[],
): SongSectionPlan[] => {
  const source = sections.length > 0 ? sections.map((section) => ({ ...section, lines: [...section.lines] })) : [{ name: "Song", lines: ["Instrumental"] }];
  const allowed = durationsAtLeast(modelDurations, MIN_CHUNK_SECONDS);
  const usable = allowed.length > 0 ? allowed : modelDurations;
  const seconds = Math.max(MIN_CHUNK_SECONDS, Math.round(length));
  let clips = planSegments(seconds, usable);
  if (sum(clips) < MIN_CHUNK_SECONDS) clips = [clipDuration(seconds, usable)];
  return fitChunkBounds(assignClips(source, clips)).map((group) => ({
    name: group.name,
    lines: group.lines,
    clips: group.clips,
    durationSec: sum(group.clips),
  }));
};

/** One shot per clip. A singer photo makes every other shot a lip-sync performance, starting with the first. */
export const planShots = (sections: readonly SongSectionPlan[], hasSinger: boolean): SongShot[] => {
  const shots: SongShot[] = [];
  let start = 0;
  for (const section of sections) {
    const lines = spreadLines(section.lines, section.clips.length);
    section.clips.forEach((duration, clipIndex) => {
      const index = shots.length;
      shots.push({
        index,
        startSec: start,
        durationSec: duration,
        lines: lines[clipIndex] ?? [],
        kind: hasSinger && index % 2 === 0 ? "performance" : "broll",
        sectionName: section.name,
      });
      start += duration;
    });
  }
  return shots;
};

/** Clip lengths both the chosen video model and the singer model can film. */
export const durationsForLyrics = (modelDurations: readonly number[], singerDurations: readonly number[] | null) => {
  if (!singerDurations) return modelDurations;
  const both = modelDurations.filter((duration) => singerDurations.includes(duration));
  return both.length > 0 ? both : modelDurations;
};

export const lyricsCreditBreakdown = (length: number, modelDurations: readonly number[], hasSinger: boolean) => {
  const shots = planShots(planSongSections([{ name: "Song", lines: ["line"] }], length, modelDurations), hasSinger);
  const singerSeconds = sum(shots.filter((shot) => shot.kind === "performance").map((shot) => shot.durationSec));
  const brollSeconds = sum(shots.filter((shot) => shot.kind === "broll").map((shot) => shot.durationSec));
  return { singerSeconds, brollSeconds, songSeconds: singerSeconds + brollSeconds };
};

/** Styles for one composition chunk. The first chunk carries the whole-song direction. */
export const chunkStyles = (style: string, first: boolean) => {
  const parts = style
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part.length <= 80);
  const defaults = [
    "polished production",
    "clear vocals",
    "steady groove",
    "no silence between sections",
    "studio recording",
    "in tune",
  ];
  const styles = [...parts];
  for (const extra of defaults) {
    if (styles.length >= (first ? 7 : 4)) break;
    if (!styles.some((item) => item.toLowerCase() === extra)) styles.push(extra);
  }
  return styles.slice(0, 50);
};

const clipText = (section: LyricSection) => {
  const lines = section.lines
    .map((line) => line.replace(/\s+/g, " ").trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 29);
  const name = section.name.replace(/[\[\]]/g, "").trim().slice(0, 100) || "Section";
  return [`[${name}]`, ...lines].join("\n");
};

export const compositionChunks = (sections: readonly SongSectionPlan[], style: string) =>
  sections.map((section, index) => ({
    text: clipText(section),
    duration_ms: Math.min(MAX_CHUNK_SECONDS * 1000, Math.max(MIN_CHUNK_SECONDS * 1000, Math.round(section.durationSec * 1000))),
    positive_styles: chunkStyles(style, index === 0),
    negative_styles: ["fade to silence", "abrupt stop", "new song", "tempo change"],
    context_adherence: "high" as const,
  }));

export type SongImageRole = "performer" | "scene" | "shot";

export interface SongReferencePlan {
  keys: string[];
  note: string;
}

const referenceSpan = (start: number, end: number) => (start === end ? `Image ${start}` : `Images ${start}-${end}`);

const referenceSentence = (role: SongImageRole, start: number, end: number) => {
  const label = referenceSpan(start, end);
  const plural = start !== end;
  if (role === "performer") return `${label} ${plural ? "are" : "is"} the performer.`;
  if (role === "scene") {
    return `${label} ${plural ? "show" : "shows"} the location: match the set and light.`;
  }
  return `${label} ${plural ? "show" : "shows"} framing: copy the camera and composition, not the people.`;
};

const referenceNote = (images: readonly { role: SongImageRole }[]) => {
  const parts: string[] = [];
  let index = 0;
  while (index < images.length) {
    const role = images[index]!.role;
    let end = index;
    while (end + 1 < images.length && images[end + 1]!.role === role) end += 1;
    parts.push(referenceSentence(role, index + 1, end + 1));
    index = end + 1;
  }
  return parts.join(" ");
};

/**
 * Pictures for one music-video clip: the performer, then the location, then framing.
 * A lip-sync shot keeps the performer and at most one location picture, so the song audio still fits.
 */
export const songReferences = (input: {
  performerKey?: string;
  sceneKeys?: readonly string[];
  directionKeys?: readonly string[];
  lipSync?: boolean;
}): SongReferencePlan => {
  const seen = new Set<string>();
  const images: { key: string; role: SongImageRole }[] = [];
  const add = (key: string | undefined, role: SongImageRole) => {
    const trimmed = key?.trim();
    if (!trimmed || seen.has(trimmed) || images.length >= MAX_SONG_SHOT_IMAGES) return false;
    seen.add(trimmed);
    images.push({ key: trimmed, role });
    return true;
  };
  add(input.performerKey, "performer");
  let scenes = 0;
  const sceneCap = input.lipSync ? 1 : MAX_LYRICS_REFERENCES;
  for (const key of input.sceneKeys ?? []) {
    if (scenes >= sceneCap) break;
    if (add(key, "scene")) scenes += 1;
  }
  if (!input.lipSync) {
    let shots = 0;
    for (const key of input.directionKeys ?? []) {
      if (shots >= MAX_LYRICS_REFERENCES) break;
      if (add(key, "shot")) shots += 1;
    }
  }
  return { keys: images.map((image) => image.key), note: referenceNote(images) };
};
