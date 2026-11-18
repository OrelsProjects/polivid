/** Formats a finished video can be downloaded as. MP4 is the file itself; the rest are made in the browser. */
export const DOWNLOAD_FORMATS = ["mp4", "gif", "wav"] as const;
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

export const DOWNLOAD_FORMAT_LABELS: Record<DownloadFormat, { title: string; detail: string }> = {
  mp4: { title: "MP4", detail: "The video with sound" },
  gif: { title: "GIF", detail: "A silent, looping animation" },
  wav: { title: "WAV", detail: "Just the sound" },
};

/** "My video.mp4" from a title, with characters files can't hold removed. */
export const downloadName = (title: string, format: DownloadFormat) => {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.(mp4|gif|wav)$/i, "")
    .slice(0, 80);
  return `${cleaned || "video"}.${format}`;
};

/** GIFs grow fast, so the longest one made is this long; a longer video gives its first part. */
export const MAX_GIF_SECONDS = 30;

/**
 * Size and frame rate for a GIF: at most 480 pixels wide (or tall), 12 frames a second for a short clip and
 * fewer for a longer one, so a 30 second GIF stays a size people can share.
 */
export const gifPlan = (durationSec: number, width: number, height: number) => {
  const seconds = Math.min(Math.max(durationSec, 0.1), MAX_GIF_SECONDS);
  const fps = seconds <= 10 ? 12 : seconds <= 20 ? 10 : 8;
  const longest = seconds <= 15 ? 480 : 360;
  const scale = Math.min(1, longest / Math.max(width, height, 1));
  const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return {
    seconds,
    fps,
    width: even(width),
    height: even(height),
    frames: Math.max(1, Math.round(seconds * fps)),
    /** GIF delays are whole hundredths of a second. */
    delayMs: Math.round(100 / fps) * 10,
    trimmed: durationSec > MAX_GIF_SECONDS,
  };
};

/** A 16-bit PCM WAV of one or more channels, interleaved. */
export const encodeWavChannels = (channels: readonly Float32Array[], sampleRate: number) => {
  const count = Math.max(1, channels.length);
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * count * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < count; channel += 1) {
      const value = Math.max(-1, Math.min(1, channels[channel]?.[frame] ?? 0));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
};
