import type { Transform } from "./schema";

/** Video clips always cover the frame: never smaller than it and never panned far enough to show an edge. */
export const coverFrame = (transform: Transform): Transform => {
  const scale = Math.max(1, transform.scale);
  const maxOffset = ((scale - 1) / 2) * 100;
  const clampOffset = (value: number) => Math.min(maxOffset, Math.max(-maxOffset, value)) || 0;
  return { ...transform, scale, x: clampOffset(transform.x), y: clampOffset(transform.y) };
};
