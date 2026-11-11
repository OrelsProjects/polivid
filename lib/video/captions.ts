import { captionChunks } from "./stills";

/** Stored as the job's model for a captioning job. Nothing is filmed. */
export const CAPTIONS_MODEL = "captions";
export const CAPTIONS_LABEL = "Captions";

/** The longest upload that is captioned in one job. */
export const MAX_CAPTION_SECONDS = 600;

export interface TimedWord {
  text: string;
  /** Seconds from the start of the file. */
  start: number;
  end: number;
}

export interface CaptionLine {
  text: string;
  start: number;
  end: number;
}

/**
 * Reads word timings out of a speech-to-text reply. Entries that are not spoken words
 * (gaps, sound labels) or that carry no usable time are left out.
 */
export const parseTimedWords = (reply: unknown): TimedWord[] => {
  if (!reply || typeof reply !== "object") return [];
  const list = (reply as { words?: unknown }).words;
  if (!Array.isArray(list)) return [];
  const words: TimedWord[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const word = entry as { text?: unknown; start?: unknown; end?: unknown; type?: unknown };
    if (typeof word.type === "string" && word.type !== "word") continue;
    const text = typeof word.text === "string" ? word.text.trim() : "";
    if (!text || typeof word.start !== "number" || typeof word.end !== "number") continue;
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0) continue;
    words.push({ text, start: word.start, end: Math.max(word.end, word.start) });
  }
  return words.sort((left, right) => left.start - right.start);
};

/**
 * Groups timed words into caption lines. A line ends at four words, at punctuation, at a
 * pause, or when it has been up long enough, so the text on screen stays close to the voice.
 */
export const captionLinesFromWords = (
  words: readonly TimedWord[],
  options: { maxWords?: number; maxPause?: number; maxSeconds?: number } = {},
): CaptionLine[] => {
  const maxWords = options.maxWords ?? 4;
  const maxPause = options.maxPause ?? 0.6;
  const maxSeconds = options.maxSeconds ?? 2.5;
  const lines: CaptionLine[] = [];
  let current: TimedWord[] = [];
  const close = () => {
    const first = current[0];
    const last = current.at(-1);
    if (first && last) lines.push({ text: current.map((word) => word.text).join(" "), start: first.start, end: last.end });
    current = [];
  };
  for (const word of words) {
    const last = current.at(-1);
    const first = current[0];
    if (last && first && (word.start - last.end > maxPause || word.end - first.start > maxSeconds)) close();
    current.push(word);
    // A sentence ends its line even at one word. A comma only does once the line has two.
    const endsSentence = /[.!?]["')\]]*$/.test(word.text);
    const endsClause = /[,;:—–]["')\]]*$/.test(word.text);
    if (current.length >= maxWords || endsSentence || (endsClause && current.length >= 2)) close();
  }
  close();
  // A line stays up until the next one starts, but never across a real pause.
  return lines.map((line, index) => {
    const next = lines[index + 1];
    const hold = next ? Math.min(next.start, line.end + maxPause) : line.end + 0.3;
    return { ...line, end: Math.max(line.end, hold) };
  });
};

/**
 * Caption lines for a transcript with no timings: the words are spread evenly across
 * the clip. Used when word-level timing is not available.
 */
export const evenCaptionLines = (text: string, seconds: number, fps: number): CaptionLine[] =>
  captionChunks(text, Math.max(1, Math.round(seconds * fps))).map((chunk) => ({
    text: chunk.text,
    start: chunk.from / fps,
    end: (chunk.from + chunk.frames) / fps,
  }));

/** The supported shape closest to a picture of this size, so a captioned upload is not letterboxed. */
export const closestFormat = (width: number | null, height: number | null): "9:16" | "1:1" | "16:9" => {
  if (!width || !height) return "9:16";
  const ratio = width / height;
  if (ratio < 0.78) return "9:16";
  if (ratio > 1.28) return "16:9";
  return "1:1";
};
