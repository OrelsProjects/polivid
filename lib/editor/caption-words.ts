import type { CaptionWord, TextItem } from "./schema";

/**
 * When each word of a caption is said, in frames from the start of the clip. Captions made from
 * timed speech carry their own; any other caption has its words spread evenly over its length,
 * so a word-by-word style still works on it, only less exactly.
 */
export const captionWords = (item: Pick<TextItem, "text" | "words" | "durationInFrames">): CaptionWord[] => {
  const texts = item.text.split(/\s+/).filter(Boolean);
  if (item.words && item.words.length === texts.length) return item.words;
  const each = item.durationInFrames / Math.max(1, texts.length);
  return texts.map((text, index) => ({ text, from: Math.round(index * each), to: Math.round((index + 1) * each) }));
};

/** The word being said at `frame`: the last one that has started. -1 before the first. */
export const activeWordIndex = (words: readonly CaptionWord[], frame: number) => {
  let active = -1;
  for (const [index, word] of words.entries()) {
    if (word.from <= frame) active = index;
    else break;
  }
  return active;
};

/** Whether a caption's look changes word by word, so it needs drawing one word at a time. */
export const isWordByWord = (item: Pick<TextItem, "style">) =>
  Boolean(item.style.activeWord) || item.style.upcomingOpacity !== undefined;
