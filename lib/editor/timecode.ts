import { FPS } from "@/lib/video/schema";

export const formatTimecode = (frame: number, fps = FPS) => {
  const total = Math.max(0, Math.round(frame));
  const seconds = Math.floor(total / fps);
  const frames = total % fps;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(minutes)}:${pad(rest)}:${pad(frames)}`;
};

export const framesFromSeconds = (seconds: number, fps = FPS) => Math.max(1, Math.round(seconds * fps));
