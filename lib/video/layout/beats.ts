import type { TimedWord } from "../captions";

/** One beat: the words said, and when, in seconds of the take. */
export interface LayoutBeat {
  say: string;
  words: TimedWord[];
  /** Where the beat's picture starts and ends. Beats are back to back, so there is no gap between them. */
  start: number;
  end: number;
}

const SENTENCE_END = /[.!?]["')\]]*$/;
const CLAUSE_END = /[,;:—–]["')\]]*$/;

/**
 * Cuts the timed words into beats. A beat closes at the end of a sentence once it has run
 * `target` seconds, at a comma when it nears `max`, and at the next word once it passes `max`.
 * `sentences` closes every beat at a sentence end, however short, for styles that cut there.
 * The first beat starts at 0 and the last ends at `total`, so the beats cover the whole take.
 */
export const beatsFromWords = (
  words: readonly TimedWord[],
  options: { target: number; max: number; total: number; sentences?: boolean },
): LayoutBeat[] => {
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];
  for (const word of words) {
    current.push(word);
    const length = word.end - current[0].start;
    const sentence = SENTENCE_END.test(word.text);
    const clause = CLAUSE_END.test(word.text);
    if (
      (sentence && (options.sentences || length >= options.target)) ||
      (clause && length >= options.max * 0.75) ||
      length >= options.max
    ) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    // A short tail joins the beat before it instead of flashing by on its own.
    const tail = current.at(-1)!.end - current[0].start;
    if (groups.length > 0 && tail < Math.min(1, options.target / 2)) groups[groups.length - 1].push(...current);
    else groups.push(current);
  }
  return groups.map((group, index) => {
    const next = groups[index + 1];
    return {
      say: group.map((word) => word.text).join(" "),
      words: group,
      start: index === 0 ? 0 : group[0].start,
      end: next ? next[0].start : Math.max(options.total, group.at(-1)!.end),
    };
  });
};

/** Caption lines inside one beat, each timed from its first word to the next line's first word. */
export const captionLines = (beat: LayoutBeat, maxWords: number) => {
  const lines: { text: string; start: number; end: number; words: TimedWord[] }[] = [];
  let line: TimedWord[] = [];
  const close = () => {
    if (line.length === 0) return;
    lines.push({ text: line.map((word) => word.text).join(" "), start: line[0].start, end: line.at(-1)!.end, words: line });
    line = [];
  };
  for (const word of beat.words) {
    line.push(word);
    if (line.length >= maxWords || (CLAUSE_END.test(word.text) || SENTENCE_END.test(word.text))) close();
  }
  close();
  // Each line stays up until the next one starts, and the last until the beat ends.
  return lines.map((item, index) => ({
    ...item,
    start: Math.max(beat.start, item.start),
    end: lines[index + 1]?.start ?? beat.end,
  }));
};

/**
 * Gives the last sentence its own beat, when the last beat holds more than one. A style that ends on
 * a card uses it, so the card carries the call to action alone.
 */
export const lastSentenceAlone = (beats: readonly LayoutBeat[]): LayoutBeat[] => {
  const last = beats.at(-1);
  if (!last) return [...beats];
  const ends = last.words.flatMap((word, index) => (SENTENCE_END.test(word.text) && index < last.words.length - 1 ? [index] : []));
  if (ends.length === 0) return [...beats];
  const cut = ends.at(-1)! + 1;
  const head = last.words.slice(0, cut);
  const tail = last.words.slice(cut);
  return [
    ...beats.slice(0, -1),
    { say: head.map((word) => word.text).join(" "), words: head, start: last.start, end: tail[0].start },
    { say: tail.map((word) => word.text).join(" "), words: tail, start: tail[0].start, end: last.end },
  ];
};
