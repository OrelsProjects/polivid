import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

export const parseByteRange = (header: string | null, size: number) => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const hasStart = match[1] !== "";
  const hasEnd = match[2] !== "";
  if (!hasStart && !hasEnd) return null;
  const start = hasStart ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = hasStart ? (hasEnd ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) {
    return "invalid" as const;
  }
  return { start, end };
};

const headersFor = (
  contentType: string,
  cacheControl: string,
  size: number,
  range: { start: number; end: number } | null,
) => {
  const length = range ? range.end - range.start + 1 : size;
  return {
    "Content-Type": contentType,
    "Content-Length": String(length),
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${size}` } : {}),
  };
};

/** Serves a local file and honors Range so the browser can seek in video and audio. */
export const rangedFileResponse = async (
  filePath: string,
  contentType: string,
  rangeHeader: string | null,
  cacheControl = "private, max-age=3600",
) => {
  const { size, mtimeMs } = await stat(filePath);
  const range = parseByteRange(rangeHeader, size);
  if (range === "invalid") {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      ...headersFor(contentType, cacheControl, size, range),
      ETag: `"${size}-${Math.round(mtimeMs)}"`,
    },
  });
};

/** Serves in-memory bytes (S3 uploads) and honors Range. */
export const rangedBytesResponse = (
  bytes: Uint8Array,
  contentType: string,
  rangeHeader: string | null,
  cacheControl = "private, max-age=3600",
) => {
  const size = bytes.byteLength;
  const range = parseByteRange(rangeHeader, size);
  if (range === "invalid") {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  return new Response(Buffer.from(bytes.subarray(start, end + 1)), {
    status: range ? 206 : 200,
    headers: headersFor(contentType, cacheControl, size, range),
  });
};
