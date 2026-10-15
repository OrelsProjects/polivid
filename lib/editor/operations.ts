import { FPS, type VideoFormat } from "@/lib/video/schema";
import {
  assetById,
  defaultTextAnimation,
  defaultTextStyle,
  defaultTransform,
  findItem,
  findTrack,
  hasTrimStart,
  itemFitsTrack,
  makeTrack,
  newId,
  type Asset,
  type AudioItem,
  type ImageItem,
  type TextItem,
  type Timeline,
  type TimelineItem,
  type Track,
  type TrackKind,
  type Transition,
  type VideoItem,
} from "./schema";

const clone = (timeline: Timeline): Timeline => structuredClone(timeline);

const replaceTrack = (timeline: Timeline, trackId: string, next: Track): Timeline => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => (track.id === trackId ? next : track)),
});

const replaceItem = (timeline: Timeline, itemId: string, next: TimelineItem): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  return replaceTrack(timeline, found.track.id, {
    ...found.track,
    items: found.track.items.map((item) => (item.id === itemId ? next : item)),
  });
};

const assertUnlocked = (track: Track) => {
  if (track.locked) throw new Error("This track is locked.");
};

const sourceLimit = (timeline: Timeline, item: TimelineItem) => {
  if (item.kind === "video" || item.kind === "audio") {
    const asset = assetById(timeline, item.assetId);
    return asset?.durationInFrames ?? null;
  }
  if (item.kind === "scene") {
    return Math.max(1, Math.round(item.scene.durationSec * FPS));
  }
  return null;
};

const clampTrimmed = (item: TimelineItem, limit: number | null): TimelineItem => {
  if (!hasTrimStart(item) || limit == null) return item;
  const maxDuration = Math.max(1, limit - item.trimStart);
  if (item.durationInFrames <= maxDuration) return item;
  return { ...item, durationInFrames: maxDuration };
};

export const addAsset = (timeline: Timeline, asset: Asset): Timeline => {
  if (timeline.assets.some((entry) => entry.id === asset.id)) return timeline;
  return { ...timeline, assets: [...timeline.assets, asset] };
};

export const addItem = (
  timeline: Timeline,
  item: TimelineItem,
  trackId?: string,
): Timeline => {
  const track =
    (trackId ? findTrack(timeline, trackId) : null) ??
    timeline.tracks.find((entry) => itemFitsTrack(item.kind, entry.kind) && !entry.locked) ??
    null;
  if (!track) throw new Error("No unlocked track can hold this clip.");
  if (!itemFitsTrack(item.kind, track.kind)) throw new Error("That clip does not belong on this track.");
  assertUnlocked(track);
  const nextItem = clampTrimmed({ ...item, from: Math.max(0, item.from) }, sourceLimit(timeline, item));
  return replaceTrack(timeline, track.id, { ...track, items: [...track.items, nextItem] });
};

export const moveItem = (
  timeline: Timeline,
  itemId: string,
  from: number,
  trackId?: string,
): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  const target = trackId ? findTrack(timeline, trackId) : found.track;
  if (!target) return timeline;
  if (!itemFitsTrack(found.item.kind, target.kind)) {
    throw new Error("That clip does not belong on this track.");
  }
  assertUnlocked(found.track);
  if (target.id !== found.track.id) assertUnlocked(target);
  const nextItem = { ...found.item, from: Math.max(0, from) };
  if (target.id === found.track.id) {
    return replaceItem(timeline, itemId, nextItem);
  }
  const without = replaceTrack(timeline, found.track.id, {
    ...found.track,
    items: found.track.items.filter((item) => item.id !== itemId),
  });
  const dest = findTrack(without, target.id);
  if (!dest) return without;
  return replaceTrack(without, dest.id, { ...dest, items: [...dest.items, nextItem] });
};

export const trimItem = (
  timeline: Timeline,
  itemId: string,
  edge: "start" | "end",
  nextFrame: number,
): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  assertUnlocked(found.track);
  const item = found.item;
  const end = item.from + item.durationInFrames;
  const limit = sourceLimit(timeline, item);

  if (edge === "end") {
    const duration = Math.max(1, nextFrame - item.from);
    return replaceItem(timeline, itemId, clampTrimmed({ ...item, durationInFrames: duration }, limit));
  }

  const clampedFrom = Math.max(0, Math.min(nextFrame, end - 1));
  const delta = clampedFrom - item.from;
  if (delta === 0) return timeline;
  const next: TimelineItem = {
    ...item,
    from: clampedFrom,
    durationInFrames: item.durationInFrames - delta,
  };
  if (hasTrimStart(next)) {
    const trimStart = Math.max(0, next.trimStart + delta);
    const limited = limit == null ? trimStart : Math.min(trimStart, Math.max(0, limit - 1));
    return replaceItem(timeline, itemId, clampTrimmed({ ...next, trimStart: limited }, limit));
  }
  return replaceItem(timeline, itemId, next);
};

export const splitItem = (timeline: Timeline, itemId: string, atFrame: number): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  assertUnlocked(found.track);
  const item = found.item;
  if (atFrame <= item.from || atFrame >= item.from + item.durationInFrames) return timeline;
  const leftDuration = atFrame - item.from;
  const rightDuration = item.durationInFrames - leftDuration;
  const left = { ...item, durationInFrames: leftDuration };
  const right: TimelineItem = {
    ...structuredClone(item),
    id: newId(),
    from: atFrame,
    durationInFrames: rightDuration,
  };
  if (hasTrimStart(right)) {
    right.trimStart = item.kind === "scene" || item.kind === "video" || item.kind === "audio" ? item.trimStart + leftDuration : right.trimStart;
  }
  return replaceTrack(timeline, found.track.id, {
    ...found.track,
    items: found.track.items.flatMap((entry) => (entry.id === itemId ? [left, right] : [entry])),
  });
};

export const deleteItem = (timeline: Timeline, itemId: string): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  assertUnlocked(found.track);
  return replaceTrack(timeline, found.track.id, {
    ...found.track,
    items: found.track.items.filter((item) => item.id !== itemId),
  });
};

export const rippleDelete = (timeline: Timeline, itemId: string): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  assertUnlocked(found.track);
  const shift = found.item.durationInFrames;
  const cut = found.item.from;
  return replaceTrack(timeline, found.track.id, {
    ...found.track,
    items: found.track.items
      .filter((item) => item.id !== itemId)
      .map((item) => (item.from >= cut ? { ...item, from: Math.max(0, item.from - shift) } : item)),
  });
};

export const duplicateItem = (timeline: Timeline, itemId: string): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  assertUnlocked(found.track);
  const copy: TimelineItem = {
    ...structuredClone(found.item),
    id: newId(),
    from: found.item.from + found.item.durationInFrames,
  };
  return replaceTrack(timeline, found.track.id, {
    ...found.track,
    items: [...found.track.items, copy],
  });
};

export const patchItem = (timeline: Timeline, itemId: string, patch: Partial<TimelineItem>): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  assertUnlocked(found.track);
  const next = { ...found.item, ...patch, id: found.item.id, kind: found.item.kind } as TimelineItem;
  return replaceItem(timeline, itemId, clampTrimmed(next, sourceLimit(timeline, next)));
};

export const setCrossfade = (timeline: Timeline, firstId: string, secondId: string, frames: number): Timeline => {
  const first = findItem(timeline, firstId);
  const second = findItem(timeline, secondId);
  if (!first || !second || first.track.id !== second.track.id) return timeline;
  assertUnlocked(first.track);
  const overlap = Math.max(1, Math.min(frames, first.item.durationInFrames - 1, second.item.durationInFrames - 1));
  const fade: Transition = { type: "fade", durationInFrames: overlap };
  const later = first.item.from <= second.item.from ? second.item : first.item;
  const earlier = later.id === first.item.id ? second.item : first.item;
  let next = replaceItem(timeline, earlier.id, { ...earlier, transitionOut: fade });
  next = replaceItem(next, later.id, { ...later, from: Math.max(0, earlier.from + earlier.durationInFrames - overlap), transitionIn: fade });
  return next;
};

export const addTrack = (timeline: Timeline, kind: TrackKind, name?: string): Timeline => {
  const label = name ?? (kind === "visual" ? "Video" : kind === "text" ? "Text" : "Audio");
  return { ...timeline, tracks: [...timeline.tracks, makeTrack(kind, label)] };
};

export const removeTrack = (timeline: Timeline, trackId: string): Timeline => {
  if (timeline.tracks.length <= 1) throw new Error("Keep at least one track.");
  const track = findTrack(timeline, trackId);
  if (!track) return timeline;
  assertUnlocked(track);
  return { ...timeline, tracks: timeline.tracks.filter((entry) => entry.id !== trackId) };
};

export const reorderTracks = (timeline: Timeline, trackId: string, toIndex: number): Timeline => {
  const fromIndex = timeline.tracks.findIndex((track) => track.id === trackId);
  if (fromIndex < 0) return timeline;
  const next = [...timeline.tracks];
  const [track] = next.splice(fromIndex, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, track);
  return { ...timeline, tracks: next };
};

export const patchTrack = (
  timeline: Timeline,
  trackId: string,
  patch: Partial<Pick<Track, "name" | "muted" | "hidden" | "locked">>,
): Timeline => {
  const track = findTrack(timeline, trackId);
  if (!track) return timeline;
  return replaceTrack(timeline, trackId, { ...track, ...patch });
};

export const setFormat = (timeline: Timeline, format: VideoFormat): Timeline => ({
  ...timeline,
  format,
});

export const createVideoItem = (asset: Asset, from: number): VideoItem => ({
  kind: "video",
  id: newId(),
  from,
  durationInFrames: Math.max(1, asset.durationInFrames ?? FPS),
  transitionIn: null,
  transitionOut: null,
  assetId: asset.id,
  trimStart: 0,
  volume: 1,
  transform: defaultTransform(),
  opacity: 1,
});

export const createImageItem = (asset: Asset, from: number): ImageItem => ({
  kind: "image",
  id: newId(),
  from,
  durationInFrames: 3 * FPS,
  transitionIn: { type: "fade", durationInFrames: 8 },
  transitionOut: { type: "fade", durationInFrames: 8 },
  assetId: asset.id,
  transform: defaultTransform(),
  opacity: 1,
});

export const createAudioItem = (asset: Asset, from: number): AudioItem => ({
  kind: "audio",
  id: newId(),
  from,
  durationInFrames: Math.max(1, asset.durationInFrames ?? FPS),
  transitionIn: null,
  transitionOut: null,
  assetId: asset.id,
  trimStart: 0,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
});

export const createTextItem = (from: number, text = "Title"): TextItem => ({
  kind: "text",
  id: newId(),
  from,
  durationInFrames: 3 * FPS,
  transitionIn: { type: "fade", durationInFrames: 8 },
  transitionOut: { type: "fade", durationInFrames: 8 },
  text,
  style: defaultTextStyle(),
  transform: defaultTransform(),
  animationIn: defaultTextAnimation(),
  animationOut: defaultTextAnimation(),
});

export const nudgeItem = (timeline: Timeline, itemId: string, frames: number): Timeline => {
  const found = findItem(timeline, itemId);
  if (!found) return timeline;
  return moveItem(timeline, itemId, Math.max(0, found.item.from + frames));
};

export { clone };
