/**
 * Markup a person can put in a script that is read word for word:
 *
 * - a new line starts a new picture
 * - `[a note]` says what the picture shows, and is not read aloud
 * - `[pause 1s]` or `<break time="1s" />` holds a silence
 *
 * Nothing here touches the network, so the form and the server count the same
 * words, seconds, and pictures.
 */
import {
  countWords,
  loopBeatCount,
  MAX_STILLS,
  secondsForWords,
  splitScript,
  STILL_SECONDS,
  stillCountFor,
  WORDS_PER_SECOND,
} from "./stills";

export const MIN_PAUSE_SECONDS = 0.1;
/** The longest silence after one beat. Several pauses in a row add up to this at most. */
export const MAX_PAUSE_SECONDS = 5;
/** A pause written without a length. */
export const DEFAULT_PAUSE_SECONDS = 1;

/** One stretch of speech, cut where a line ends or a pause falls. */
export interface ScriptRun {
  /** The words to read, with every note and pause taken out. */
  say: string;
  /** What the person asked the picture to show. Empty when they left it to us. */
  show: string;
  /** Silence after the words, in seconds. */
  pause: number;
  /** Which line of the script this came from, counting from zero. */
  line: number;
}

/** One beat of the finished video: its words, its picture note, and the silence after it. */
export interface ScriptBeat {
  say: string;
  show: string;
  pause: number;
}

const BREAK_TAG = String.raw`<\s*break\b[^>]*>`;
const PAUSE_NOTE = String.raw`\[\s*pause\b[^\[\]]*\]`;
const PAUSE = new RegExp(`${BREAK_TAG}|${PAUSE_NOTE}`, "gi");
const NOTE = /\[([^[\]]*)\]/g;

const clampPause = (seconds: number) =>
  Number(Math.min(MAX_PAUSE_SECONDS, Math.max(MIN_PAUSE_SECONDS, seconds)).toFixed(2));

/** Seconds a pause asks for. A pause with no readable length gets the default. */
const pauseSeconds = (token: string) => {
  const match = /(\d+(?:\.\d+)?|\.\d+)\s*(ms|milliseconds?|s|sec|secs|seconds?)?/i.exec(token.replace(/break|pause|time/gi, ""));
  if (!match) return DEFAULT_PAUSE_SECONDS;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT_PAUSE_SECONDS;
  return clampPause(/^m/i.test(match[2] ?? "") ? amount / 1000 : amount);
};

const tidy = (text: string) =>
  text
    .replace(/\s+/g, " ")
    // Taking a note out can leave a space ahead of the full stop that followed it.
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();

/**
 * Reads a script into its stretches of speech, in order. Notes and pauses are taken
 * out of the words. A note on a line with no words steers the next picture.
 */
export const parseScript = (script: string): ScriptRun[] => {
  const runs: ScriptRun[] = [];
  let waiting: string[] = [];
  script.split(/\r?\n/).forEach((raw, line) => {
    let cursor = 0;
    const take = (text: string) => {
      const notes: string[] = [];
      const say = tidy(
        text.replace(NOTE, (_all, note: string) => {
          if (note.trim()) notes.push(tidy(note));
          return " ";
        }),
      );
      if (!say) {
        waiting.push(...notes);
        return;
      }
      runs.push({ say, show: [...waiting, ...notes].join("; "), pause: 0, line });
      waiting = [];
    };
    for (const match of raw.matchAll(PAUSE)) {
      take(raw.slice(cursor, match.index));
      cursor = match.index + match[0].length;
      const last = runs[runs.length - 1];
      // A pause before the first word has nothing to follow, so it is left out.
      if (last) last.pause = clampPause(last.pause + pauseSeconds(match[0]));
    }
    take(raw.slice(cursor));
  });
  const last = runs[runs.length - 1];
  if (last && waiting.length > 0) last.show = [last.show, ...waiting].filter(Boolean).join("; ");
  return runs;
};

/** True when the script uses a note or a pause. */
export const hasScriptMarkup = (script: string) => new RegExp(PAUSE.source, "i").test(script) || /\[[^[\]]*\]/.test(script);

/** The words that are read aloud, with notes and pauses removed. */
export const spokenScript = (script: string) =>
  parseScript(script)
    .map((run) => run.say)
    .join(" ");

/** Splits one run that is too long for a single picture, keeping its note on every part. */
const splitRun = (run: ScriptBeat, parts: number): ScriptBeat[] => {
  const says = splitScript(run.say, parts);
  return says.map((say, index) => ({ say, show: run.show, pause: index === says.length - 1 ? run.pause : 0 }));
};

/** Joins the two neighbours with the fewest words between them until the count fits. */
const mergeDown = (beats: ScriptBeat[], most: number): ScriptBeat[] => {
  const merged = beats.map((beat) => ({ ...beat }));
  while (merged.length > Math.max(1, most)) {
    let at = 0;
    let fewest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < merged.length - 1; index += 1) {
      const words = countWords(merged[index]!.say) + countWords(merged[index + 1]!.say);
      if (words < fewest) {
        fewest = words;
        at = index;
      }
    }
    const first = merged[at]!;
    const second = merged[at + 1]!;
    const shows = first.show === second.show ? [first.show] : [first.show, second.show];
    merged.splice(at, 2, {
      say: `${first.say} ${second.say}`,
      show: shows.filter(Boolean).join("; "),
      // The silence between the two moves to the end of the joined beat.
      pause: first.pause + second.pause > 0 ? clampPause(first.pause + second.pause) : 0,
    });
  }
  return merged;
};

/**
 * The pictures for a script read word for word. Each line and each pause starts a new
 * picture, a long line is cut into several, and more lines than we can draw are joined.
 * A plain one-line script is cut by length, the way a written script is.
 */
export const stillBeatsForScript = (script: string, lengthSec: number): ScriptBeat[] => {
  const runs = parseScript(script);
  if (runs.length === 0) return [];
  const only = runs[0]!;
  if (runs.length === 1 && !only.show && only.pause === 0) {
    return splitScript(only.say, stillCountFor(lengthSec, countWords(only.say))).map((say) => ({ say, show: "", pause: 0 }));
  }
  const wordsPerStill = STILL_SECONDS * WORDS_PER_SECOND;
  const beats = runs.flatMap((run) => splitRun(run, Math.max(1, Math.round(countWords(run.say) / wordsPerStill))));
  return mergeDown(beats, MAX_STILLS);
};

/**
 * The caption beats for a script read over a background. Lines and notes change nothing
 * there. Only a pause ends a beat early.
 */
export const loopBeatsForScript = (script: string): ScriptBeat[] => {
  const beats: ScriptBeat[] = [];
  let open: string[] = [];
  const close = (pause: number) => {
    const text = open.join(" ");
    open = [];
    if (!text) return;
    const says = splitScript(text, loopBeatCount(countWords(text)));
    says.forEach((say, index) => beats.push({ say, show: "", pause: index === says.length - 1 ? pause : 0 }));
  };
  for (const run of parseScript(script)) {
    open.push(run.say);
    if (run.pause > 0) close(run.pause);
  }
  close(0);
  return beats;
};

export interface ScriptSize {
  /** Words read aloud. */
  words: number;
  /** Silence the script asks for, in seconds. */
  pauseSeconds: number;
  /** How long the script takes to read, pauses included. */
  seconds: number;
}

/** How big a word-for-word script is once its notes and pauses are taken out. */
export const scriptSize = (script: string): ScriptSize => {
  const runs = parseScript(script);
  const words = runs.reduce((sum, run) => sum + countWords(run.say), 0);
  const pauses = runs.reduce((sum, run) => sum + run.pause, 0);
  return {
    words,
    pauseSeconds: Number(pauses.toFixed(2)),
    seconds: pauses > 0 ? Math.ceil(words / WORDS_PER_SECOND + pauses) : secondsForWords(words),
  };
};

/**
 * Pictures an animated-stills video draws when its script is read word for word.
 * Undefined for every other video, which is priced by its length.
 */
export const stillPictureCount = (input: {
  prompt: string;
  verbatim?: boolean;
  media?: string | null;
  length: number;
}) => {
  if (!input.verbatim || input.media !== "stills") return undefined;
  const pictures = stillBeatsForScript(input.prompt, input.length).length;
  return pictures > 0 ? pictures : undefined;
};
