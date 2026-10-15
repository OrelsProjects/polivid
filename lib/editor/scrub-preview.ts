export const SCRUB_FPS = 15;

export const scrubMetaUrl = (videoId: string) => `/api/videos/${videoId}/scrub`;
export const scrubFrameUrl = (videoId: string, index: number) => `/api/videos/${videoId}/scrub/${index}`;

export const scrubIndexForTime = (time: number, fps: number, count: number) => {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(time * fps)));
};

const metaCache = new Map<string, { fps: number; count: number }>();
const metaInflight = new Map<string, Promise<{ fps: number; count: number } | null>>();
const prefetched = new Set<string>();

export const loadScrubMeta = async (videoId: string) => {
  const cached = metaCache.get(videoId);
  if (cached) return cached;
  const pending = metaInflight.get(videoId);
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch(scrubMetaUrl(videoId));
    if (!response.ok) return null;
    const meta = (await response.json()) as { fps: number; count: number };
    metaCache.set(videoId, meta);
    return meta;
  })().finally(() => {
    metaInflight.delete(videoId);
  });
  metaInflight.set(videoId, request);
  return request;
};

export const prefetchScrubFrames = async (videoId: string) => {
  if (prefetched.has(videoId)) return;
  const meta = await loadScrubMeta(videoId);
  if (!meta) return;
  prefetched.add(videoId);
  for (let index = 0; index < meta.count; index += 1) {
    const image = new Image();
    image.decoding = "async";
    image.src = scrubFrameUrl(videoId, index);
  }
};
