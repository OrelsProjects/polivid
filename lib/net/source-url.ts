import "server-only";
import { extractPage } from "./extract-article";
import { FetchPageError, fetchPublicPage } from "./safe-fetch";

/** A page shorter than this is a paywall notice, a cookie wall, or an app shell, not an article. */
export const MIN_SOURCE_CHARS = 200;

export interface ResolvedSource {
  url: string;
  title: string;
  text: string;
}

/** Fetches a public page and returns its readable text. Throws a message meant for the person. */
export const resolveSourceUrl = async (raw: string, limit?: number): Promise<ResolvedSource> => {
  const page = await fetchPublicPage(raw);
  const extracted = extractPage(page.text, { limit, plainText: /^text\/plain\b/i.test(page.contentType) });
  if (extracted.text.length < MIN_SOURCE_CHARS) {
    throw new FetchPageError("We couldn't find enough text on that page. Paste the text instead.");
  }
  return { url: page.url, title: extracted.title, text: extracted.text };
};
