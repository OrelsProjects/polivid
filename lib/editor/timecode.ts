import { FPS } from "@/lib/video/schema";

const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatTimecode = (frame: number, fps = FPS) => {
  const total = Math.max(0, Math.round(frame));
  const seconds = Math.floor(total / fps);
  const frames = total % fps;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${pad2(minutes)}:${pad2(rest)}:${pad2(frames)}`;
};

/** Revid-style clock, e.g. 00:03.22 */
export const formatClock = (frame: number, fps = FPS) => {
  const total = Math.max(0, frame) / fps;
  let minutes = Math.floor(total / 60);
  let seconds = total - minutes * 60;
  let whole = Math.floor(seconds);
  let cents = Math.round((seconds - whole) * 100);
  if (cents === 100) {
    cents = 0;
    whole += 1;
  }
  if (whole === 60) {
    whole = 0;
    minutes += 1;
  }
  return `${pad2(minutes)}:${pad2(whole)}.${pad2(cents)}`;
};

export const framesFromSeconds = (seconds: number, fps = FPS) => Math.max(1, Math.round(seconds * fps));
