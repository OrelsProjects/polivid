export type Waveform = {
  /** Bar heights from 0 to 1, covering only the audible part of the track. */
  bars: number[];
  /** Seconds until the sound fades below hearing. Generated songs carry a quiet fade tail after this. */
  audibleEnd: number;
  duration: number;
};

const WINDOW_SECONDS = 0.01;
/** A track counts as over once it stays this far below its loud level. */
const TAIL_DB = 20;
const MIN_BAR = 0.12;

/** Loudness per bar and the audible end, from decoded PCM channels. */
export const analyzeWaveform = (channels: Float32Array[], sampleRate: number, barCount: number): Waveform | null => {
  const length = channels[0]?.length ?? 0;
  if (length === 0 || sampleRate <= 0 || barCount <= 0) return null;
  const duration = length / sampleRate;
  const windowSize = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS));
  const windows = Math.ceil(length / windowSize);
  const rms = new Float32Array(windows);
  for (let window = 0; window < windows; window += 1) {
    const from = window * windowSize;
    const to = Math.min(length, from + windowSize);
    let sum = 0;
    for (const channel of channels) {
      for (let index = from; index < to; index += 1) sum += channel[index] * channel[index];
    }
    rms[window] = Math.sqrt(sum / ((to - from) * channels.length));
  }

  const sorted = Array.from(rms).sort((a, b) => a - b);
  const loud = sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0;
  if (loud <= 0) return { bars: Array.from({ length: barCount }, () => MIN_BAR), audibleEnd: duration, duration };

  const threshold = loud * 10 ** (-TAIL_DB / 20);
  let last = windows - 1;
  while (last > 0 && rms[last] < threshold) last -= 1;
  const audibleWindows = last + 1;
  const audibleEnd = Math.min(duration, (audibleWindows * windowSize) / sampleRate);

  let peak = 0;
  for (let window = 0; window < audibleWindows; window += 1) peak = Math.max(peak, rms[window]);
  const bars = Array.from({ length: barCount }, (_, bar) => {
    const from = Math.floor((bar * audibleWindows) / barCount);
    const to = Math.max(from + 1, Math.floor(((bar + 1) * audibleWindows) / barCount));
    let level = 0;
    for (let window = from; window < Math.min(to, audibleWindows); window += 1) level = Math.max(level, rms[window]);
    return MIN_BAR + (1 - MIN_BAR) * Math.sqrt(level / peak);
  });
  return { bars, audibleEnd, duration };
};
