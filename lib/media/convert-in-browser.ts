import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { encodeWavChannels, gifPlan } from "./download-formats";

/**
 * Turns a finished MP4 into other formats in the browser. The server has no ffmpeg on the web side,
 * and these are quick for a short video, so nothing is uploaded or queued.
 */

const SEEK_TIMEOUT_MS = 8000;

const loadVideo = (url: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("The browser couldn't open this video."));
    video.src = url;
  });

const seek = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= 2) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => reject(new Error("The video stopped loading while the GIF was made.")), SEEK_TIMEOUT_MS);
    video.onseeked = () => {
      window.clearTimeout(timer);
      resolve();
    };
    video.currentTime = time;
  });

/** The video's sound as a WAV, at its own sample rate, in stereo when it has two channels. */
export const videoToWav = async (src: string) => {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Couldn't download the video.");
  const data = await response.arrayBuffer();
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(data);
  } catch {
    throw new Error("This video has no sound to save.");
  } finally {
    void context.close();
  }
  const channels = Array.from({ length: Math.min(2, decoded.numberOfChannels) }, (_, index) => decoded.getChannelData(index));
  return new Blob([encodeWavChannels(channels, decoded.sampleRate) as BlobPart], { type: "audio/wav" });
};

/**
 * A looping GIF of the video, without sound: at most 480 pixels on its long side and up to its first
 * 30 seconds. `onProgress` gets 0 to 1 as frames are drawn.
 */
export const videoToGif = async (src: string, onProgress?: (share: number) => void) => {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Couldn't download the video.");
  const url = URL.createObjectURL(await response.blob());
  const video = await loadVideo(url).catch((error: unknown) => {
    URL.revokeObjectURL(url);
    throw error;
  });
  try {
    const plan = gifPlan(video.duration, video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser can't make GIFs.");
    const gif = GIFEncoder();
    for (let frame = 0; frame < plan.frames; frame += 1) {
      await seek(video, Math.min(frame / plan.fps, Math.max(0, video.duration - 0.05)));
      context.drawImage(video, 0, 0, plan.width, plan.height);
      const { data } = context.getImageData(0, 0, plan.width, plan.height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), plan.width, plan.height, { palette, delay: plan.delayMs });
      onProgress?.((frame + 1) / plan.frames);
      // Let the page repaint the progress now and then.
      if (frame % 4 === 3) await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    gif.finish();
    return { blob: new Blob([gif.bytes() as BlobPart], { type: "image/gif" }), trimmed: plan.trimmed };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
};

/** Saves a file the page made, with this name. */
export const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Starts a download of a file the server serves, with this name. */
export const saveLink = (href: string, name: string) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
};
