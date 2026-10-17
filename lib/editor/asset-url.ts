import { uploadFileUrl } from "@/lib/storage/upload-key";
import type { Asset, Timeline } from "./schema";

export const browserAssetUrl = (asset: Asset) => {
  if (asset.source.type === "upload") return uploadFileUrl(asset.source.key);
  if (asset.source.type === "production") return `/api/productions/assets/${asset.source.assetId}`;
  if (asset.source.type === "song") return `/api/songs/${asset.source.songId}`;
  return `/api/videos/${asset.source.videoId}/file`;
};

export const assetUrlMap = (timeline: Timeline, resolve: (asset: Asset) => string | null) => {
  const urls: Record<string, string> = {};
  for (const asset of timeline.assets) {
    const url = resolve(asset);
    if (url) urls[asset.id] = url;
  }
  return urls;
};
