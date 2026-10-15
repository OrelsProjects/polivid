import { readAssetToken } from "@/lib/editor/asset-token";
import { db } from "@/lib/db";
import { rangedBytesResponse, rangedFileResponse } from "@/lib/http/range";
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

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const payload = readAssetToken(decodeURIComponent(token));
  if (!payload) return new Response("Not found.", { status: 404 });
  const range = request.headers.get("range");

  try {
    if (payload.source.type === "upload") {
      if (!isOwnedUploadKey(payload.userId, payload.source.key) || !hasS3Config()) {
        return new Response("Not found.", { status: 404 });
      }
      const { bytes, contentType } = await getUpload(payload.source.key);
      return rangedBytesResponse(bytes, contentType, range, "private, max-age=300");
    }

    if (payload.source.type === "production") {
      const { getAssetForUser } = await import("@/lib/production/store");
      const { readProductionBytes } = await import("@/lib/production/assets");
      const asset = await getAssetForUser(payload.userId, payload.source.assetId);
      if (!asset) return new Response("Not found.", { status: 404 });
      const file = await readProductionBytes(asset.storageKey);
      return rangedBytesResponse(file.bytes, file.contentType, range, "private, max-age=300");
    }

    const row = await db.video.findFirst({
      where: { id: payload.source.videoId, userId: payload.userId },
      select: { id: true },
    });
    if (!row || !hasFootage(row.id)) return new Response("Not found.", { status: 404 });
    return rangedFileResponse(footagePath(row.id), contentTypeFor(footagePath(row.id)), range, "private, max-age=300");
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
