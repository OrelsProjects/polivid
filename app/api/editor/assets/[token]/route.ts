import { readAssetToken } from "@/lib/editor/asset-token";
import { db } from "@/lib/db";
import { rangedBytesResponse } from "@/lib/http/range";
import { getUpload, hasS3Config } from "@/lib/storage/s3";
import { isOwnedUploadKey } from "@/lib/storage/upload-key";
import { footageResponse, sourceFootageKey, voiceMediaKey } from "@/lib/video/footage";
import { videoMediaResponse } from "@/lib/video/media-store";

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

    if (payload.source.type === "song") {
      const { readSongDraft, readSongDraftAudio } = await import("@/lib/music/song-draft");
      const draft = await readSongDraft(payload.userId, payload.source.songId);
      if (!draft) return new Response("Not found.", { status: 404 });
      const bytes = await readSongDraftAudio(draft.id);
      if (!bytes) return new Response("Not found.", { status: 404 });
      return rangedBytesResponse(bytes, "audio/mpeg", range, "private, max-age=300");
    }

    if (payload.source.type === "production") {
      const { getAssetForUser } = await import("@/lib/production/store");
      const { readProductionBytes } = await import("@/lib/production/assets");
      const asset = await getAssetForUser(payload.userId, payload.source.assetId);
      if (!asset) return new Response("Not found.", { status: 404 });
      const file = await readProductionBytes(asset.storageKey);
      return rangedBytesResponse(file.bytes, file.contentType, range, "private, max-age=300");
    }

    if (payload.source.type !== "video" && payload.source.type !== "voice") {
      return new Response("Not found.", { status: 404 });
    }
    const row = await db.video.findFirst({
      where: { id: payload.source.videoId, userId: payload.userId },
      select: { id: true },
    });
    // A video that is still being made has no library row yet. Its own job may read its layers.
    const owner =
      row ??
      (await db.videoJob.findFirst({
        where: { id: payload.source.videoId, userId: payload.userId },
        select: { id: true },
      }));
    if (!owner) return new Response("Not found.", { status: 404 });
    if (payload.source.type === "voice") {
      const voice = await videoMediaResponse(voiceMediaKey(owner.id), "audio/mpeg", range, "private, max-age=300");
      return voice ?? new Response("Not found.", { status: 404 });
    }
    if (payload.source.layer === "source") {
      const source = await videoMediaResponse(sourceFootageKey(owner.id), "video/mp4", range, "private, max-age=300");
      if (source) return source;
    }
    const response = await footageResponse(owner.id, range, "private, max-age=300");
    return response ?? new Response("Not found.", { status: 404 });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
