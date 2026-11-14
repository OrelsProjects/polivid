import "server-only";
import { FetchPageError, fetchPublicFile, UnsafeUrlError } from "@/lib/net/safe-fetch";
import { hasS3Config, MAX_IMAGE_BYTES, MAX_MEDIA_BYTES, putUpload, UPLOAD_TYPES, uploadObjectKey } from "@/lib/storage/s3";
import { IMAGE_EXTS, uploadFileUrl } from "@/lib/storage/upload-key";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, text } from "./support";

const EXT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(UPLOAD_TYPES).map(([type, ext]) => [ext === "jpg" ? "jpeg" : ext, type]),
);

/** A server that sends a generic type still counts when the link ends in a known extension. */
const typeFor = (contentType: string, url: string) => {
  if (UPLOAD_TYPES[contentType]) return contentType;
  const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext === "jpg" ? "jpeg" : ext] ?? null;
};

export const importMediaFromUrlHandler: ToolHandler = async (input, ctx) => {
  if (!hasS3Config()) return { error: "Uploads are not configured on this server." };
  const url = text(asRecord(input).url);
  try {
    const file = await fetchPublicFile(url, MAX_MEDIA_BYTES);
    const type = typeFor(file.contentType, file.url);
    if (!type) return { error: `That link is ${file.contentType || "an unknown type"}. Use JPEG, PNG, WebP, MP3, WAV, M4A, MP4, WebM, or MOV.` };
    const ext = UPLOAD_TYPES[type];
    if (IMAGE_EXTS.has(ext) && file.bytes.byteLength > MAX_IMAGE_BYTES) return { error: "Pictures must be under 4 MB." };
    if (file.bytes.byteLength === 0) return { error: "That file is empty." };
    const key = uploadObjectKey(ctx.userId, ext);
    await putUpload(key, new Uint8Array(file.bytes), type);
    const kind = IMAGE_EXTS.has(ext) ? "image" : type.startsWith("audio/") ? "audio" : "video";
    return { key, kind, contentType: type, bytes: file.bytes.byteLength, url: uploadFileUrl(key) };
  } catch (error) {
    if (error instanceof UnsafeUrlError || error instanceof FetchPageError) return { error: error.message };
    throw error;
  }
};
