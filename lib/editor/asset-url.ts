import { uploadFileUrl } from "@/lib/storage/upload-key";
import { backgroundById } from "@/lib/video/backgrounds";
import type { Asset, Timeline } from "./schema";

export const browserAssetUrl = (asset: Asset) => {
  const source = asset.source;
  if (source.type === "upload") return uploadFileUrl(source.key);
  if (source.type === "production") return `/api/productions/assets/${source.assetId}`;
  if (source.type === "song") return `/api/songs/${source.songId}`;
  if (source.type === "voice") return `/api/videos/${source.videoId}/voice`;
  if (source.type === "library") return backgroundById(source.id)?.file ?? "";
  const layer = source.layer === "source" ? "?layer=source" : "";
  return `/api/videos/${source.videoId}/file${layer}`;
};

export const assetUrlMap = (timeline: Timeline, resolve: (asset: Asset) => string | null) => {
  const urls: Record<string, string> = {};
  for (const asset of timeline.assets) {
    const url = resolve(asset);
    if (url) urls[asset.id] = url;
  }
  return urls;
};
