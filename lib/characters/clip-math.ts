/** Pure helpers behind pulling frames and sound out of a character clip. No DOM, so they are testable. */

/** Sharpness of a grayscale image: variance of its Laplacian. Blurry or motion-smeared frames score low. */
export const laplacianVariance = (gray: ArrayLike<number>, width: number, height: number) => {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
};

/** RGBA pixels to luminance. */
export const toGray = (rgba: ArrayLike<number>) => {
  const out = new Float32Array(Math.floor(rgba.length / 4));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return out;
};

/** Evenly spread sample times inside the clip, skipping the very start and end. */
export const candidateTimes = (durationSec: number, count: number) => {
  if (!(durationSec > 0) || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => durationSec * (0.06 + (0.88 * index) / Math.max(1, count - 1)));
};

/** The sharpest frames, at least minGapSec apart, returned in time order. */
export const pickSharpSpaced = (candidates: { time: number; score: number }[], count: number, minGapSec: number) => {
  const chosen: { time: number; score: number }[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    if (chosen.length >= count) break;
    if (chosen.every((item) => Math.abs(item.time - candidate.time) >= minGapSec)) chosen.push(candidate);
  }
  return chosen.sort((a, b) => a.time - b.time);
};

/** Mono 16-bit PCM WAV. */
export const encodeWav = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Uint8Array(buffer);
};

/** Share of samples louder than a whisper. Near zero means the clip has no usable speech. */
export const loudShare = (samples: Float32Array, threshold = 0.02) => {
  if (samples.length === 0) return 0;
  let loud = 0;
  for (let i = 0; i < samples.length; i += 1) if (Math.abs(samples[i]) > threshold) loud += 1;
  return loud / samples.length;
};
