/**
 * The `/` character menu in a prompt box. Typing `/` at the start of a word opens it,
 * the letters after it filter the list, and picking a character puts their name in the
 * text where the `/` was. Pure text logic, so the menu can be tested without a browser.
 */

/** The `/word` being typed just before the caret, or null when there is none. */
export const slashTokenAt = (text: string, caret: number) => {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const match = /(^|\s)\/([^\s/]{0,40})$/.exec(before);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
};

/** Puts the name where the `/word` was, with a space after it unless one already follows. */
export const insertCharacterName = (text: string, start: number, caret: number, name: string) => {
  const before = text.slice(0, start);
  const after = text.slice(caret);
  const gap = /^[\s.,!?;:)]/.test(after) ? "" : " ";
  const inserted = `${name}${gap}`;
  return { text: before + inserted + after, caret: before.length + inserted.length };
};

/** Characters whose name matches, those starting with the letters first. */
export const matchCharacters = <T extends { name: string }>(characters: readonly T[], query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...characters];
  const starts = characters.filter((character) => character.name.toLowerCase().startsWith(needle));
  const contains = characters.filter(
    (character) => !starts.includes(character) && character.name.toLowerCase().includes(needle),
  );
  return [...starts, ...contains];
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches the name as a whole word, so "Orel" is not found inside "Oreland". */
const namePattern = (name: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${escape(name)}(?![\\p{L}\\p{N}_])`, "gu");

/** Where the name appears in the text as a whole word. */
export const nameRanges = (text: string, name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return [];
  return [...text.matchAll(namePattern(trimmed))].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
};

export const mentionsName = (text: string, name: string) => nameRanges(text, name).length > 0;

/** Swaps the name for words a video model understands, since it only sees the picture. */
export const nameAsPicture = (text: string, name: string, replacement = "the person in the picture") => {
  const trimmed = name.trim();
  return trimmed ? text.replace(namePattern(trimmed), replacement) : text;
};
