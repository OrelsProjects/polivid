/**
 * A skit: the writer's character acts the script out, one short filmed shot per beat, while the
 * character's own voice reads the script word for word over the shots.
 *
 * - Each sentence is a beat. A `[note]` says what the character does in that beat, and is never read.
 * - A beat with no note shows the character acting out its own line.
 * - A very short beat with no note is joined to a neighbour, since a shot can't be shorter than the
 *   model's shortest clip. A beat with a note keeps its own shot: that's the gag.
 *
 * Nothing here touches the network, so the price and the filmed video plan the same beats.
 */
import { NO_ON_SCREEN_TEXT } from "./on-screen-text";
import { clampPause, pauseSeconds, tidy } from "./script-markup";
import { countWords, WORDS_PER_SECOND } from "./stills";
import { filmSecondsFor } from "./shot-plan";

/** More shots than this gets too choppy to follow, and each one costs a clip. */
export const MAX_SKIT_BEATS = 12;

export interface SkitBeat {
  /** The words read aloud over this shot. */
  say: string;
  /** What the writer asked the character to do here. Empty means: act out the line. */
  show: string;
  /** How long the shot runs, a length the model can film. */
  seconds: number;
}

interface Piece {
  say: string;
  show: string;
  pause: number;
}

const SENTENCE_END = /(?<=[.!?…]["'”’)]*)\s+/;
/** A pause, a note, or a break tag, kept as its own token when a line is split. */
const MARK = /(<\s*break\b[^>]*>|\[[^[\]]*\])/i;
const IS_PAUSE = /^(<\s*break\b[^>]*>|\[\s*pause\b[^[\]]*\])$/i;
const LEADING_PUNCTUATION = /^[.,!?;:…"'”’)]+/;

const sentencesOf = (text: string) =>
  tidy(text)
    .split(SENTENCE_END)
    .map((part) => part.trim())
    .filter(Boolean);

const addShow = (piece: Piece, notes: readonly string[]) => {
  piece.show = [piece.show, ...notes].filter(Boolean).join("; ");
};

/**
 * The script as spoken pieces, in order. A note steers the sentence that comes right after it on
 * its line; a note with nothing after it steers the sentence before it. Pauses add silence to the
 * piece they follow. The spoken words come out exactly as `spokenScript` reads them.
 */
const piecesOf = (script: string): Piece[] => {
  const pieces: Piece[] = [];
  let carried: string[] = [];
  for (const line of script.split(/\r?\n/)) {
    const startOfLine = pieces.length;
    let pending: string[] = [...carried];
    carried = [];
    for (const token of line.split(MARK)) {
      if (!token.trim()) continue;
      if (IS_PAUSE.test(token.trim())) {
        const last = pieces.at(-1);
        if (last) last.pause = clampPause(last.pause + pauseSeconds(token));
        continue;
      }
      if (MARK.test(token) && token.trim().startsWith("[")) {
        const note = tidy(token.trim().slice(1, -1));
        if (note) pending.push(note);
        continue;
      }
      let text = tidy(token);
      const last = pieces.at(-1);
      // Punctuation right after a note ends the sentence before it, the way the script is read, and
      // a note inside that sentence ("Hello [waves].") steers it.
      const lead = LEADING_PUNCTUATION.exec(text)?.[0] ?? "";
      if (lead && last) {
        last.say = `${last.say}${lead}`;
        if (pending.length > 0) addShow(last, pending);
        pending = [];
        text = text.slice(lead.length).trim();
      }
      for (const say of sentencesOf(text)) {
        pieces.push({ say, show: pending.join("; "), pause: 0 });
        pending = [];
      }
    }
    if (pending.length === 0) continue;
    // Notes at the end of a line belong to that line's last sentence, or wait for the next line's.
    if (pieces.length > startOfLine) addShow(pieces.at(-1)!, pending);
    else carried = pending;
  }
  if (carried.length > 0 && pieces.length > 0) addShow(pieces.at(-1)!, carried);
  return pieces;
};

const spokenSeconds = (piece: Piece) => countWords(piece.say) / WORDS_PER_SECOND + piece.pause;

const join = (first: Piece, second: Piece): Piece => ({
  say: `${first.say} ${second.say}`.trim(),
  show: [first.show, second.show].filter(Boolean).join("; "),
  pause: first.pause + second.pause,
});

/** Joins the pair of neighbours with the fewest words, the way scripts are merged elsewhere. */
const mergeSmallestPair = (pieces: Piece[]) => {
  let at = 0;
  let fewest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < pieces.length - 1; index += 1) {
    const words = countWords(pieces[index]!.say) + countWords(pieces[index + 1]!.say);
    if (words < fewest) {
      fewest = words;
      at = index;
    }
  }
  pieces.splice(at, 2, join(pieces[at]!, pieces[at + 1]!));
};

/**
 * Joins one very short beat with no note to its shorter neighbour, so a shot isn't mostly silence.
 * False when there is none left to join.
 */
const mergeOneShort = (pieces: Piece[], tooShort: number) => {
  const at = pieces.findIndex((piece) => !piece.show && spokenSeconds(piece) < tooShort);
  if (at < 0 || pieces.length < 2) return false;
  const before = at > 0 ? pieces[at - 1]! : null;
  const after = at < pieces.length - 1 ? pieces[at + 1]! : null;
  const withBefore = before && (!after || spokenSeconds(before) <= spokenSeconds(after));
  if (withBefore) pieces.splice(at - 1, 2, join(before, pieces[at]!));
  else pieces.splice(at, 2, join(pieces[at]!, after!));
  return true;
};

/** The script's beats, each with the length of the shot that films it. */
export const skitBeats = (script: string, durations: readonly number[]): SkitBeat[] => {
  const pieces = piecesOf(script);
  if (pieces.length === 0) return [];
  const shortest = durations.length > 0 ? Math.min(...durations) : 1;
  // Under half the shortest shot, a line on its own would be mostly silence.
  while (mergeOneShort(pieces, shortest / 2));
  while (pieces.length > MAX_SKIT_BEATS) mergeSmallestPair(pieces);
  return pieces.map((piece) => ({
    say: piece.say,
    show: piece.show,
    seconds: filmSecondsFor(Math.ceil(spokenSeconds(piece)), durations),
  }));
};

/** The cuts a skit is filmed and priced as: one per beat. */
export const skitCuts = (script: string, durations: readonly number[]) =>
  skitBeats(script, durations).map((beat) => ({ seconds: beat.seconds, camera: "", action: beat.show || beat.say }));

/** Seconds the finished skit runs: every shot, back to back. */
export const skitSeconds = (beats: readonly SkitBeat[]) => beats.reduce((sum, beat) => sum + beat.seconds, 0);

/**
 * What one shot films. The character is whoever the reference pictures show, kept exactly as they
 * look there, in their own art style. Nothing else is added: no look, no setting, no mood.
 */
export const skitShotPrompt = (input: { beat: SkitBeat; pictures: number; direction?: string }) => {
  const label = input.pictures > 1 ? `Images 1-${input.pictures} show` : "Image 1 shows";
  return [
    "One continuous shot. Film only this beat.",
    input.beat.show
      ? `Action: ${input.beat.show}`
      : `Action: the character acts out this line, without saying it: "${input.beat.say}"`,
    input.direction?.trim() ? `Direction: ${input.direction.trim()}` : "",
    input.pictures > 0 ? `${label} the character. Keep their exact look and art style.` : "",
    NO_ON_SCREEN_TEXT,
  ]
    .filter(Boolean)
    .join("\n");
};

/** Why a character can't act in a skit, in words to show, or null when it can. */
export const skitCharacterProblem = (character: { imageKey: string | null; providerVoiceId: string | null } | null) => {
  if (!character || !character.imageKey) return "Pick a character that has a picture.";
  if (!character.providerVoiceId) return "This character has no voice yet. Give it a voice to make a skit.";
  return null;
};
