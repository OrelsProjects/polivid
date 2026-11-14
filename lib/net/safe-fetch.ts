import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isPublicAddress, parsePublicUrl, UnsafeUrlError } from "./public-address";

export { UnsafeUrlError } from "./public-address";

export class FetchPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchPageError";
  }
}

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const TEXT_TYPE = /^(text\/html|application\/xhtml\+xml|text\/plain)\b/i;

/**
 * Resolves a host and hands back only public addresses. The connection is then made to
 * the address that was checked, so a host cannot answer "public" here and "private" a
 * moment later when the socket opens.
 */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses: LookupAddress[]) => {
    if (error) {
      callback(error, "", 4);
      return;
    }
    if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
      callback(new UnsafeUrlError(), "", 4);
      return;
    }
    if (typeof options === "object" && options.all) {
      (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, addresses);
      return;
    }
    const first = addresses[0];
    callback(null, first?.address ?? "", first?.family ?? 4);
  });
};

interface RawResponse {
  status: number;
  location: string | null;
  contentType: string;
  body: Buffer;
}

const PAGE_ACCEPT = "text/html,application/xhtml+xml,text/plain;q=0.8";

const requestOnce = (url: URL, signal: AbortSignal, maxBytes = MAX_BYTES, accept = PAGE_ACCEPT) =>
  new Promise<RawResponse>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      url,
      {
        method: "GET",
        lookup: publicLookup,
        signal,
        headers: {
          accept,
          "accept-language": "en",
          "user-agent": "Mozilla/5.0 (compatible; page-reader/1.0)",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = typeof response.headers.location === "string" ? response.headers.location : null;
        const contentType = String(response.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          response.resume();
          resolve({ status, location, contentType, body: Buffer.alloc(0) });
          return;
        }
        const declared = Number(response.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          request.destroy();
          reject(new FetchPageError("That page is too large to read."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > maxBytes) {
            request.destroy();
            reject(new FetchPageError("That page is too large to read."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ status, location, contentType, body: Buffer.concat(chunks) }));
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end();
  });

const decode = (body: Buffer, contentType: string) => {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
};

/**
 * Downloads one public web page as text. Follows a few redirects, checking each hop the
 * same way as the first, and gives up on anything slow, large, or not a page.
 */
export const fetchPublicPage = async (raw: string) => {
  let url = parsePublicUrl(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: RawResponse;
    try {
      response = await requestOnce(url, signal);
    } catch (error) {
      if (error instanceof UnsafeUrlError || error instanceof FetchPageError) throw error;
      if (signal.aborted) throw new FetchPageError("That page took too long to answer.");
      throw new FetchPageError("We couldn't reach that page.");
    }
    if (response.status >= 300 && response.status < 400) {
      if (!response.location) throw new FetchPageError("That link doesn't lead to a page.");
      url = parsePublicUrl(new URL(response.location, url).toString());
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new FetchPageError(
        response.status === 401 || response.status === 403
          ? "That page doesn't let us read it. Paste the text instead."
          : "That page didn't load. Check the link, or paste the text instead.",
      );
    }
    if (!TEXT_TYPE.test(response.contentType)) {
      throw new FetchPageError("That link isn't a web page. Paste the text instead.");
    }
    return { url: url.toString(), contentType: response.contentType, text: decode(response.body, response.contentType) };
  }
  throw new FetchPageError("That link redirects too many times.");
};

/**
 * Downloads one public file (a picture, a song, a clip) with the same address checks as a page.
 * Gives up on anything slow or over maxBytes.
 */
export const fetchPublicFile = async (raw: string, maxBytes: number) => {
  let url = parsePublicUrl(raw);
  const signal = AbortSignal.timeout(30_000);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: RawResponse;
    try {
      response = await requestOnce(url, signal, maxBytes, "*/*");
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      if (error instanceof FetchPageError) throw new FetchPageError(`That file is over ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      if (signal.aborted) throw new FetchPageError("That file took too long to download.");
      throw new FetchPageError("We couldn't reach that file.");
    }
    if (response.status >= 300 && response.status < 400) {
      if (!response.location) throw new FetchPageError("That link doesn't lead to a file.");
      url = parsePublicUrl(new URL(response.location, url).toString());
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new FetchPageError(`That file didn't download (${response.status}).`);
    return { url: url.toString(), contentType: response.contentType.split(";")[0].trim().toLowerCase(), bytes: response.body };
  }
  throw new FetchPageError("That link redirects too many times.");
};
