import type { Timeline } from "./schema";

export const SNAP_TOLERANCE_PX = 8;

export const snapCandidates = (timeline: Timeline, playheadFrame: number, excludeItemIds: Iterable<string> = []) => {
  const skip = new Set(excludeItemIds);
  const edges = [0, Math.max(0, playheadFrame)];
  for (const track of timeline.tracks) {
    for (const item of track.items) {
      if (skip.has(item.id)) continue;
      edges.push(item.from, item.from + item.durationInFrames);
    }
  }
  return edges;
};

export const snapFrame = (frame: number, candidates: number[], pixelsPerFrame: number, tolerancePx = SNAP_TOLERANCE_PX) => {
  const tolerance = Math.max(1, Math.round(tolerancePx / Math.max(pixelsPerFrame, 0.25)));
  let best = frame;
  let bestDist = tolerance + 1;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - frame);
    if (distance < bestDist) {
      best = candidate;
      bestDist = distance;
    }
  }
  return best;
};
