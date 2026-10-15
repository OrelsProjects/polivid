import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

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

export interface RangedSource {
  size: number;
  etag: string | null;
  contentType: string;
  /** Opens bytes start..end (inclusive). */
  open: (start: number, end: number) => Promise<ReadableStream<Uint8Array>>;
}

/** Serves a stored file without loading it into memory, and honors Range so the browser can seek. */
export const rangedStreamResponse = async (
  source: RangedSource,
  rangeHeader: string | null,
  cacheControl = "private, max-age=3600",
) => {
  const range = parseByteRange(rangeHeader, source.size);
  if (range === "invalid") {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${source.size}` },
    });
  }
  const stream = await source.open(range?.start ?? 0, range?.end ?? source.size - 1);
  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      ...headersFor(source.contentType, cacheControl, source.size, range),
      ...(source.etag ? { ETag: source.etag } : {}),
    },
  });
};

/** Serves a local file and honors Range so the browser can seek in video and audio. */
export const rangedFileResponse = async (
  filePath: string,
  contentType: string,
  rangeHeader: string | null,
  cacheControl = "private, max-age=3600",
) => {
  const { size, mtimeMs } = await stat(filePath);
  const source: RangedSource = {
    size,
    etag: `"${size}-${Math.round(mtimeMs)}"`,
    contentType,
    open: async (start, end) => fileStream(filePath, start, end),
  };
  return rangedStreamResponse(source, rangeHeader, cacheControl);
};

const fileStream = (filePath: string, start: number, end: number) => {
  const file = createReadStream(filePath, { start, end });
  const iterator = file[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value as Uint8Array);
      } catch {
        file.destroy();
        try {
          controller.error(new Error("Could not read the video."));
        } catch {
          // The browser closed the stream after seeking or leaving the page.
        }
      }
    },
    cancel() {
      file.destroy();
      void iterator.return?.(undefined).catch(() => undefined);
    },
  });
  return stream;
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
