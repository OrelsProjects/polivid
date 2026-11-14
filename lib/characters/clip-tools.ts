"use client";

import { candidateTimes, encodeWav, laplacianVariance, loudShare, pickSharpSpaced, toGray } from "./clip-math";

const once = (target: EventTarget, event: string, timeoutMs = 15_000) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("The clip took too long to load."));
    }, timeoutMs);
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("The browser couldn't read that clip."));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(event, done);
      target.removeEventListener("error", fail);
    };
    target.addEventListener(event, done);
    target.addEventListener("error", fail);
  });

const loadVideo = async (url: string) => {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = url;
  await once(video, "loadeddata");
  return video;
};

const seek = async (video: HTMLVideoElement, time: number) => {
  video.currentTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05));
  await once(video, "seeked");
};

/** Clip length in seconds, read in the browser before upload. */
export const clipDuration = async (file: File) => {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await once(video, "loadedmetadata");
    return Number.isFinite(video.duration) ? video.duration : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * The sharpest frames of a clip as JPEGs, spread out over its length.
 * Runs in the browser so it works on hosts without ffmpeg.
 */
export const extractSharpFrames = async (url: string, count = 4) => {
  const video = await loadVideo(url);
  const duration = video.duration;
  if (!(duration > 0)) throw new Error("That clip has no length.");
  const probe = document.createElement("canvas");
  const probeWidth = 160;
  probe.width = probeWidth;
  probe.height = Math.max(1, Math.round((probeWidth * video.videoHeight) / Math.max(1, video.videoWidth)));
  const probeContext = probe.getContext("2d", { willReadFrequently: true });
  if (!probeContext) throw new Error("This browser can't read video frames.");
  const scored: { time: number; score: number }[] = [];
  for (const time of candidateTimes(duration, Math.max(count * 3, 8))) {
    await seek(video, time);
    probeContext.drawImage(video, 0, 0, probe.width, probe.height);
    const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
    scored.push({ time, score: laplacianVariance(toGray(pixels), probe.width, probe.height) });
  }
  const chosen = pickSharpSpaced(scored, count, duration / (count * 2));
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't read video frames.");
  const frames: { blob: Blob; time: number }[] = [];
  for (const frame of chosen) {
    await seek(video, frame.time);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (blob) frames.push({ blob, time: frame.time });
  }
  video.removeAttribute("src");
  video.load();
  return frames;
};

const VOICE_SAMPLE_RATE = 22_050;
const MAX_VOICE_SECONDS = 30;

/** The clip's sound as a mono WAV, for building a voice. Throws when the clip is silent. */
export const extractVoiceWav = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Couldn't download that clip.");
  const data = await response.arrayBuffer();
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(data);
  } catch {
    throw new Error("That clip has no sound the browser can read.");
  } finally {
    void context.close();
  }
  const seconds = Math.min(decoded.duration, MAX_VOICE_SECONDS);
  const offline = new OfflineAudioContext(1, Math.ceil(seconds * VOICE_SAMPLE_RATE), VOICE_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0, 0, seconds);
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  if (loudShare(samples) < 0.05) throw new Error("That clip is almost silent. Use one where they talk.");
  return new Blob([encodeWav(samples, VOICE_SAMPLE_RATE) as BlobPart], { type: "audio/wav" });
};
