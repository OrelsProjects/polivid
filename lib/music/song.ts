import type { SongSectionPlan, SongShot, SongWord } from "./song-plan";

export const songMediaKey = (jobId: string) => `${jobId}.song.mp3`;

export const songSliceKey = (jobId: string, index: number) => `${jobId}.song-${index}.wav`;

export interface StoredSong {
  style: string;
  sections: SongSectionPlan[];
  shots: SongShot[];
  words: SongWord[];
  prompts: string[];
}

const isWord = (value: unknown): value is SongWord => {
  if (!value || typeof value !== "object") return false;
  const word = value as SongWord;
  return typeof word.text === "string" && typeof word.startMs === "number" && typeof word.endMs === "number";
};

const isShot = (value: unknown): value is SongShot => {
  if (!value || typeof value !== "object") return false;
  const shot = value as SongShot;
  return (
    Number.isInteger(shot.index) &&
    typeof shot.startSec === "number" &&
    typeof shot.durationSec === "number" &&
    shot.durationSec > 0 &&
    Array.isArray(shot.lines) &&
    (shot.kind === "performance" || shot.kind === "broll") &&
    typeof shot.sectionName === "string"
  );
};

/** The song saved on a lyrics job. Missing or incomplete plans return null so older jobs stay on the clip-audio path. */
export const readStoredSong = (artifacts: unknown): StoredSong | null => {
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return null;
  const song = (artifacts as Record<string, unknown>).song;
  if (!song || typeof song !== "object" || Array.isArray(song)) return null;
  const record = song as Record<string, unknown>;
  if (!Array.isArray(record.shots) || record.shots.length === 0 || !record.shots.every(isShot)) return null;
  if (!Array.isArray(record.sections) || !Array.isArray(record.words) || !record.words.every(isWord)) return null;
  if (!Array.isArray(record.prompts) || !record.prompts.every((prompt) => typeof prompt === "string")) return null;
  return {
    style: typeof record.style === "string" ? record.style : "",
    sections: record.sections as SongSectionPlan[],
    shots: record.shots,
    words: record.words,
    prompts: record.prompts,
  };
};
