import { pictureForMention, type CoachPictureRef } from "@/lib/coach/picture-mentions";
import { linkKnownIds, type CoachResultLink } from "@/lib/coach/result-links";

export type CoachMarkdownLink = Pick<CoachResultLink, "id" | "href">;

export type CoachInline =
  | { type: "text"; text: string }
  | { type: "bold"; children: CoachInline[] }
  | { type: "italic"; children: CoachInline[] }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "image"; url: string; alt: string };

export type CoachBlock =
  | { type: "paragraph"; children: CoachInline[] }
  | { type: "list"; ordered: boolean; items: CoachInline[][] };

const UNORDERED = /^[ \t]*[-*+•][ \t]+(.*)$/;
const ORDERED = /^[ \t]*\d{1,3}[.)][ \t]+(.*)$/;
const ESCAPABLE = new Set(["\\", "`", "*", "_"]);
const MAX_INLINE_DEPTH = 8;

const isWord = (char: string | undefined) => char !== undefined && /[0-9A-Za-z]/.test(char);
const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

const splitKeepSpace = (value: string) => {
  const parts: string[] = [];
  let buffer = "";
  let spacing = false;
  for (const char of value) {
    const space = char === " " || char === "\t" || char === "\n";
    if (buffer && space !== spacing) {
      parts.push(buffer);
      buffer = "";
    }
    spacing = space;
    buffer += char;
  }
  if (buffer) parts.push(buffer);
  return parts;
};

const mentionNodes = (value: string, pictures: readonly CoachPictureRef[]): CoachInline[] => {
  if (!value) return [];
  if (pictures.length === 0) return [{ type: "text", text: value }];
  return splitKeepSpace(value).map((part): CoachInline => {
    if (part === " " || part === "\t" || part === "\n" || part.trim() === "") return { type: "text", text: part };
    const picture = pictureForMention(part, pictures);
    return picture ? { type: "image", url: picture.url, alt: "" } : { type: "text", text: part };
  });
};

const textNodes = (value: string, links: readonly CoachMarkdownLink[], pictures: readonly CoachPictureRef[]): CoachInline[] => {
  if (!value) return [];
  return linkKnownIds(value, links).flatMap((piece): CoachInline[] => {
    if (!piece.text) return [];
    if (piece.kind === "link") return [{ type: "link", text: piece.text, href: piece.href }];
    return mentionNodes(piece.text, pictures);
  });
};

/** Next `marker`, skipping backslash escapes and inline code so markers inside code stay literal. */
const indexOfMarker = (source: string, from: number, marker: string) => {
  let index = from;
  while (index < source.length) {
    if (source[index] === "\\" && index + 1 < source.length) {
      index += 2;
      continue;
    }
    if (source[index] === "`") {
      const close = source.indexOf("`", index + 1);
      if (close === -1) return -1;
      index = close + 1;
      continue;
    }
    if (source.startsWith(marker, index)) return index;
    index += 1;
  }
  return -1;
};

const indexOfSingle = (source: string, from: number, marker: "*" | "_") => {
  let index = from;
  while (index < source.length) {
    if (source[index] === "\\" && index + 1 < source.length) {
      index += 2;
      continue;
    }
    if (source[index] === "`") {
      const close = source.indexOf("`", index + 1);
      if (close === -1) return -1;
      index = close + 1;
      continue;
    }
    if (source.startsWith(marker + marker, index)) {
      index += 2;
      continue;
    }
    if (source[index] === marker) return index;
    index += 1;
  }
  return -1;
};

const italicClose = (source: string, open: number, marker: "*" | "_") => {
  if (source[open + 1] === marker || isSpace(source[open + 1]) || source[open + 1] === undefined) return -1;
  if (marker === "_" && isWord(source[open - 1])) return -1;
  let from = open + 1;
  while (from < source.length) {
    const close = indexOfSingle(source, from, marker);
    if (close === -1) return -1;
    if (close > open + 1 && !isSpace(source[close - 1]) && !(marker === "_" && isWord(source[close + 1]))) return close;
    from = close + 1;
  }
  return -1;
};

const parseInlines = (
  source: string,
  links: readonly CoachMarkdownLink[],
  pictures: readonly CoachPictureRef[],
  depth = 0,
): CoachInline[] => {
  if (!source) return [];
  if (depth > MAX_INLINE_DEPTH) return textNodes(source, links, pictures);
  const nodes: CoachInline[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (!buffer) return;
    nodes.push(...textNodes(buffer, links, pictures));
    buffer = "";
  };

  while (index < source.length) {
    const char = source[index] ?? "";
    if (char === "\\" && index + 1 < source.length && ESCAPABLE.has(source[index + 1] ?? "")) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }
    if (char === "`") {
      const close = source.indexOf("`", index + 1);
      if (close > index + 1) {
        flush();
        const code = source.slice(index + 1, close);
        const picture = pictureForMention(code, pictures);
        nodes.push(picture ? { type: "image", url: picture.url, alt: "" } : { type: "code", text: code });
        index = close + 1;
        continue;
      }
    }
    if ((char === "*" || char === "_") && source[index + 1] === char) {
      const close = indexOfMarker(source, index + 2, char + char);
      if (close > index + 2) {
        flush();
        nodes.push({ type: "bold", children: parseInlines(source.slice(index + 2, close), links, pictures, depth + 1) });
        index = close + 2;
        continue;
      }
    }
    if (char === "*" || char === "_") {
      const close = italicClose(source, index, char);
      if (close !== -1) {
        flush();
        nodes.push({ type: "italic", children: parseInlines(source.slice(index + 1, close), links, pictures, depth + 1) });
        index = close + 1;
        continue;
      }
    }
    buffer += char;
    index += 1;
  }

  flush();
  return tidyPictureMentions(nodes);
};

const pictureLabel = (node: CoachInline) => {
  if (node.type !== "text") return false;
  const text = node.text.trim().toLowerCase();
  return text === "image" || text === "image:";
};

const visibleBeside = (nodes: CoachInline[], index: number, step: 1 | -1) => {
  for (let cursor = index + step; cursor >= 0 && cursor < nodes.length; cursor += step) {
    const node = nodes[cursor];
    if (node?.type === "text" && node.text.trim() === "") continue;
    return node;
  }
  return undefined;
};

/** Drops the "Image" label and the period that only introduced a picture. */
const tidyPictureMentions = (nodes: CoachInline[]): CoachInline[] => {
  const next: CoachInline[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (pictureLabel(node) && visibleBeside(nodes, index, 1)?.type === "image") continue;
    if (node.type === "text" && node.text.trim() === "." && visibleBeside(nodes, index, -1)?.type === "image") continue;
    next.push(node);
  }
  return next;
};

/**
 * A small markdown subset for assistant prose: bold, italics, inline code, and lists.
 * Tags stay text. The only links are job and production ids the caller already knows.
 */
export const parseCoachMarkdown = (
  text: string,
  links: readonly CoachMarkdownLink[] = [],
  pictures: readonly CoachPictureRef[] = [],
): CoachBlock[] => {
  const blocks: CoachBlock[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    const joined = paragraph
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
    paragraph = [];
    if (!joined) return;
    blocks.push({ type: "paragraph", children: parseInlines(joined, links, pictures) });
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({
      type: "list",
      ordered: list.ordered,
      items: list.items.map((item) => parseInlines(item.trim(), links, pictures)),
    });
    list = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const ordered = line.match(ORDERED);
    const marker = ordered ?? line.match(UNORDERED);
    if (marker) {
      const item = (marker[1] ?? "").trim();
      if (!item) {
        flushParagraph();
        flushList();
        continue;
      }
      flushParagraph();
      const nextOrdered = Boolean(ordered);
      if (list && list.ordered !== nextOrdered) flushList();
      if (!list) list = { ordered: nextOrdered, items: [] };
      list.items.push(item);
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
};
