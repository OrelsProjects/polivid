import "server-only";
import { db } from "@/lib/db";
import { signedGetUrl } from "@/lib/storage/s3";
import { isOwnedUploadKey } from "@/lib/storage/upload-key";
import { footageKey, sourceFootageKey, voiceMediaKey } from "@/lib/video/footage";
import { hasVideoMedia, signedVideoMediaUrl } from "@/lib/video/media-store";
import type { AssetSource } from "./schema";

/** Long enough for a slow render to finish reading every clip. */
const RENDER_LINK_SECONDS = 2 * 60 * 60;

/**
 * A signed S3 link a render on the worker can read a clip from directly. The worker sits next to the
 * bucket, so this avoids sending every byte through the website (in another region) on each range
 * request Chrome makes while decoding. Null for anything that has no direct file, or isn't the person's;
 * those still go through the website's asset route.
 */
export const directAssetUrl = async (userId: string, source: AssetSource): Promise<string | null> => {
  if (source.type === "upload") {
    return isOwnedUploadKey(userId, source.key) ? signedGetUrl(source.key, RENDER_LINK_SECONDS) : null;
  }
  if (source.type !== "video" && source.type !== "voice") return null;
  const owner =
    (await db.video.findFirst({ where: { id: source.videoId, userId }, select: { id: true } })) ??
    (await db.videoJob.findFirst({ where: { id: source.videoId, userId }, select: { id: true } }));
  if (!owner) return null;
  if (source.type === "voice") return signedVideoMediaUrl(voiceMediaKey(owner.id), RENDER_LINK_SECONDS);
  if (source.layer === "source" && (await hasVideoMedia(sourceFootageKey(owner.id)))) {
    return signedVideoMediaUrl(sourceFootageKey(owner.id), RENDER_LINK_SECONDS);
  }
  return signedVideoMediaUrl(footageKey(owner.id), RENDER_LINK_SECONDS);
};
