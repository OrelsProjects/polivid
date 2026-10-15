import { readFile } from "node:fs/promises";
import { readAssetToken } from "@/lib/editor/asset-token";
import { db } from "@/lib/db";
import { getUpload, hasS3Config } from "@/lib/storage/s3";
import { isOwnedUploadKey } from "@/lib/storage/upload-key";
import { footagePath, hasFootage } from "@/lib/video/footage";

const contentTypeFor = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "video/mp4";
};

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const payload = readAssetToken(decodeURIComponent(token));
  if (!payload) return new Response("Not found.", { status: 404 });

  try {
    if (payload.source.type === "upload") {
      if (!isOwnedUploadKey(payload.userId, payload.source.key) || !hasS3Config()) {
        return new Response("Not found.", { status: 404 });
      }
      const { bytes, contentType } = await getUpload(payload.source.key);
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    const row = await db.video.findFirst({
      where: { id: payload.source.videoId, userId: payload.userId },
      select: { id: true },
    });
    if (!row || !hasFootage(row.id)) return new Response("Not found.", { status: 404 });
    const bytes = await readFile(footagePath(row.id));
    return new Response(bytes, {
      headers: {
        "Content-Type": contentTypeFor(footagePath(row.id)),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
