import "server-only";
import { overwriteProductionBytes, readProductionBytes } from "./assets";
import { healProductionMedia } from "./placeholder-media";

export interface CachedAsset {
  bytes: Uint8Array;
  contentType: string;
}

const MAX_CACHE_BYTES = 256 * 1024 * 1024;

const cache = (globalThis as unknown as { productionAssetCache?: Map<string, CachedAsset> }).productionAssetCache ?? new Map<string, CachedAsset>();
(globalThis as unknown as { productionAssetCache?: Map<string, CachedAsset> }).productionAssetCache = cache;

const cachedBytes = () => [...cache.values()].reduce((sum, entry) => sum + entry.bytes.byteLength, 0);

const remember = (key: string, entry: CachedAsset) => {
  cache.delete(key);
  cache.set(key, entry);
  let total = cachedBytes();
  for (const oldest of cache.keys()) {
    if (total <= MAX_CACHE_BYTES) break;
    total -= cache.get(oldest)?.bytes.byteLength ?? 0;
    cache.delete(oldest);
  }
};

/**
 * Media players issue many Range requests per clip. Keep recently served
 * assets in memory so each request does not re-download the whole object.
 */
export const loadProductionAsset = async (asset: { id: string; kind: string; storageKey: string; sha256: string }): Promise<CachedAsset> => {
  const key = `${asset.storageKey}:${asset.sha256}`;
  const hit = cache.get(key);
  if (hit) {
    remember(key, hit);
    return hit;
  }
  const stored = await readProductionBytes(asset.storageKey);
  let bytes: Uint8Array = stored.bytes;
  let contentType = stored.contentType;
  const healed = await healProductionMedia(asset.kind, bytes, contentType, asset.id);
  if (healed) {
    await overwriteProductionBytes(asset.storageKey, healed.bytes, healed.contentType);
    bytes = healed.bytes;
    contentType = healed.contentType;
  }
  const entry = { bytes, contentType };
  remember(key, entry);
  return entry;
};
