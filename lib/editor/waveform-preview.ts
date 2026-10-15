export interface WaveformMeta {
  rate: number;
  hasAudio: boolean;
  peaks: number[];
}

const cache = new Map<string, WaveformMeta>();
const inflight = new Map<string, Promise<WaveformMeta | null>>();

export const loadWaveform = async (videoId: string) => {
  const cached = cache.get(videoId);
  if (cached) return cached;
  const pending = inflight.get(videoId);
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch(`/api/videos/${videoId}/waveform`);
    if (!response.ok) return null;
    const meta = (await response.json()) as WaveformMeta;
    cache.set(videoId, meta);
    return meta;
  })().finally(() => {
    inflight.delete(videoId);
  });
  inflight.set(videoId, request);
  return request;
};

export const slicePeaks = (meta: WaveformMeta, startSeconds: number, durationSeconds: number, barCount: number) => {
  if (!meta.hasAudio || meta.peaks.length === 0 || barCount <= 0) return [];
  const start = Math.max(0, Math.floor(startSeconds * meta.rate));
  const end = Math.min(meta.peaks.length, Math.ceil((startSeconds + durationSeconds) * meta.rate));
  const slice = meta.peaks.slice(start, Math.max(start + 1, end));
  const bars: number[] = [];
  for (let index = 0; index < barCount; index += 1) {
    const from = Math.floor((index / barCount) * slice.length);
    const to = Math.max(from + 1, Math.floor(((index + 1) / barCount) * slice.length));
    let peak = 0;
    for (let cursor = from; cursor < to; cursor += 1) peak = Math.max(peak, slice[cursor] ?? 0);
    bars.push(peak);
  }
  return bars;
};
