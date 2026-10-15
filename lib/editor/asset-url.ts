import { uploadFileUrl } from "@/lib/storage/upload-key";
import type { Asset, Timeline } from "./schema";

export const browserAssetUrl = (asset: Asset) => {
  if (asset.source.type === "upload") return uploadFileUrl(asset.source.key);
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
