/**
 * Pulls the readable text out of a web page without a parser dependency.
 * It prefers what the page itself marks as the article, and falls back to the body
 * with the navigation, scripts, and other furniture removed.
 */

export interface ExtractedPage {
  title: string;
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
};

const fromCodePoint = (code: number) => {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
};

export const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) return fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return fromCodePoint(Number.parseInt(body.slice(1), 10));
    return ENTITIES[body.toLowerCase()] ?? match;
  });

const DROPPED =
  /<(script|style|noscript|template|svg|iframe|nav|header|footer|aside|form|button|select|figure|picture|video|audio|canvas|sup)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK_END = /<\/(p|div|section|article|li|ul|ol|h[1-6]|blockquote|tr|table|pre|main)\s*>|<br\s*\/?>|<hr\s*\/?>/gi;

/** Turns a fragment of HTML into paragraphs of plain text. */
export const htmlToText = (html: string) => {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(DROPPED, " ")
    .replace(BLOCK_END, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t\r\f\v\u00a0]+/g, " ")
        // Inline tags leave a gap before the punctuation that followed them.
        .replace(/ ([,.;:!?])/g, "$1")
        .trim(),
    )
    // Wiki-style section controls are page furniture, not prose.
    .filter((line) => line.length > 0 && !/^\[\s*(edit|source|citation needed)\s*\]$/i.test(line))
    .join("\n");
};

const firstTag = (html: string, tag: string) => {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, "i").exec(html);
  return match?.[1] ?? "";
};

/** The longest element of this kind. A page can hold several, and the story is the big one. */
const longestTag = (html: string, tag: string) => {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, "gi");
  let best = "";
  for (const match of html.matchAll(pattern)) {
    const inner = match[1] ?? "";
    if (inner.length > best.length) best = inner;
  }
  return best;
};

const metaContent = (html: string, name: string) => {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (key !== name) continue;
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const value = content?.[1] ?? content?.[2] ?? "";
    if (value.trim()) return decodeEntities(value).trim();
  }
  return "";
};

const jsonLdField = (value: unknown, field: string, depth = 0): string => {
  if (depth > 6 || value === null || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = jsonLdField(item, field, depth + 1);
      if (found) return found;
    }
    return "";
  }
  const record = value as Record<string, unknown>;
  const direct = record[field];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  for (const child of Object.values(record)) {
    const found = jsonLdField(child, field, depth + 1);
    if (found) return found;
  }
  return "";
};

const jsonLd = (html: string, field: string) => {
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const found = jsonLdField(JSON.parse(match[1] ?? ""), field);
      if (found) return found;
    } catch {
      // A page with broken structured data still has its visible text.
    }
  }
  return "";
};

/** Paragraphs short enough to be menus, bylines, or share buttons are left out of a fallback read. */
const proseOnly = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.length >= 60 || /[.!?…]["’”)]?$/.test(line))
    .join("\n");

const tidy = (text: string, limit: number) => {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("\n"));
  return (stop > limit * 0.6 ? cut.slice(0, stop + 1) : cut).trim();
};

/**
 * Reads the title and main text of a page. Plain text is passed through.
 * `limit` caps the text so it fits the create form.
 */
export const extractPage = (source: string, options: { limit?: number; plainText?: boolean } = {}): ExtractedPage => {
  const limit = options.limit ?? 9000;
  if (options.plainText || !/<[a-z!][\s\S]*>/i.test(source)) {
    return { title: "", text: tidy(source, limit) };
  }
  const title =
    metaContent(source, "og:title") ||
    jsonLd(source, "headline") ||
    htmlToText(firstTag(source, "title")).split("\n")[0] ||
    htmlToText(firstTag(source, "h1")).split("\n")[0] ||
    "";

  const structured = decodeEntities(jsonLd(source, "articleBody"));
  const article = htmlToText(longestTag(source, "article"));
  const main = htmlToText(longestTag(source, "main"));
  const body = proseOnly(htmlToText(firstTag(source, "body") || source));
  const candidates = [structured, article, main].filter((text) => text.length >= 200);
  const text =
    candidates.sort((left, right) => right.length - left.length)[0] ??
    (body.length >= 200 ? body : [metaContent(source, "og:description"), metaContent(source, "description")].find(Boolean) ?? body);

  return { title: title.trim().slice(0, 200), text: tidy(text, limit) };
};
