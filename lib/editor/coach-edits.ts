import { FPS } from "@/lib/video/schema";
import {
  addAsset,
  addItem,
  createAudioItem,
  createTextItem,
  deleteItem,
  moveItem,
  patchItem,
  patchTrack,
  rippleDelete,
  splitItem,
  trimItem,
} from "./operations";
import {
  assetById,
  defaultTextStyle,
  findItem,
  findTrack,
  timelineDurationInFrames,
  type Asset,
  type Timeline,
  type TimelineItem,
} from "./schema";

export type TextPosition = "top" | "center" | "bottom";

export interface EditChange {
  timeline: Timeline;
  changedItemIds: string[];
}

export interface TimelineReading {
  durationSec: number;
  tracks: {
    id: string;
    kind: string;
    name: string;
    muted: boolean;
    items: {
      id: string;
      kind: string;
      startSec: number;
      endSec: number;
      text?: string;
      name?: string;
    }[];
  }[];
}

const seconds = (frames: number) => Math.round((frames / FPS) * 100) / 100;
const frames = (value: number) => Math.max(0, Math.round(value * FPS));

const positionY: Record<TextPosition, number> = { top: -28, center: 0, bottom: 32 };

const requireItem = (timeline: Timeline, itemId: string) => {
  const found = findItem(timeline, itemId);
  if (!found) throw new Error("That clip is not on the timeline. Read the timeline and use an id from it.");
  return found;
};

const itemName = (timeline: Timeline, item: TimelineItem) => {
  if (item.kind === "text") return item.text;
  if (item.kind === "scene") return item.scene.headline;
  if (item.kind === "video" || item.kind === "image" || item.kind === "audio") {
    return assetById(timeline, item.assetId)?.name;
  }
  return undefined;
};

/** A short map the Coach can quote back. Times are seconds. */
export const readTimeline = (timeline: Timeline): TimelineReading => ({
  durationSec: seconds(timelineDurationInFrames(timeline)),
  tracks: timeline.tracks.map((track) => ({
    id: track.id,
    kind: track.kind,
    name: track.name,
    muted: track.muted,
    items: track.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      startSec: seconds(item.from),
      endSec: seconds(item.from + item.durationInFrames),
      text: item.kind === "text" ? item.text : undefined,
      name: itemName(timeline, item),
    })),
  })),
});

export const addTextEdit = (
  timeline: Timeline,
  input: { text: string; startSec?: number; endSec?: number; position?: TextPosition },
): EditChange => {
  const item = createTextItem(frames(input.startSec ?? 0), input.text);
  if (input.endSec != null) item.durationInFrames = Math.max(1, frames(input.endSec) - item.from);
  item.transform = { ...item.transform, y: positionY[input.position ?? "center"] };
  return { timeline: addItem(timeline, item), changedItemIds: [item.id] };
};

export const updateTextEdit = (
  timeline: Timeline,
  input: { itemId: string; text?: string; position?: TextPosition },
): EditChange => {
  const found = requireItem(timeline, input.itemId);
  if (found.item.kind !== "text") throw new Error("That clip is not a title.");
  const next = patchItem(timeline, input.itemId, {
    text: input.text ?? found.item.text,
    transform: input.position ? { ...found.item.transform, y: positionY[input.position] } : found.item.transform,
  });
  return { timeline: next, changedItemIds: [input.itemId] };
};

export const trimEdit = (timeline: Timeline, input: { itemId: string; startSec?: number; endSec?: number }): EditChange => {
  requireItem(timeline, input.itemId);
  if (input.startSec == null && input.endSec == null) throw new Error("Pass a start or an end, in seconds.");
  let next = timeline;
  if (input.startSec != null) next = trimItem(next, input.itemId, "start", frames(input.startSec));
  if (input.endSec != null) next = trimItem(next, input.itemId, "end", frames(input.endSec));
  return { timeline: next, changedItemIds: [input.itemId] };
};

export const splitEdit = (timeline: Timeline, input: { itemId: string; atSec: number }): EditChange => {
  const found = requireItem(timeline, input.itemId);
  const at = frames(input.atSec);
  if (at <= found.item.from || at >= found.item.from + found.item.durationInFrames) {
    throw new Error("Split inside the clip, not on its edge.");
  }
  const before = new Set(found.track.items.map((item) => item.id));
  const next = splitItem(timeline, input.itemId, at);
  const created = findItem(next, input.itemId);
  const track = created ? findTrack(next, created.track.id) : null;
  const added = track?.items.find((item) => !before.has(item.id));
  return { timeline: next, changedItemIds: added ? [input.itemId, added.id] : [input.itemId] };
};

export const removeEdit = (timeline: Timeline, input: { itemId: string; ripple?: boolean }): EditChange => {
  requireItem(timeline, input.itemId);
  const next = input.ripple ? rippleDelete(timeline, input.itemId) : deleteItem(timeline, input.itemId);
  return { timeline: next, changedItemIds: [input.itemId] };
};

export const moveEdit = (timeline: Timeline, input: { itemId: string; startSec: number }): EditChange => {
  requireItem(timeline, input.itemId);
  return { timeline: moveItem(timeline, input.itemId, frames(input.startSec)), changedItemIds: [input.itemId] };
};

export const addMusicEdit = (
  timeline: Timeline,
  asset: Asset,
  input: { startSec?: number; volume?: number; fadeInSec?: number; fadeOutSec?: number },
): EditChange => {
  if (asset.kind !== "audio") throw new Error("That file is not audio.");
  const item = createAudioItem(asset, frames(input.startSec ?? 0));
  item.volume = input.volume ?? 0.35;
  item.fadeIn = frames(input.fadeInSec ?? 0.4);
  item.fadeOut = frames(input.fadeOutSec ?? 0.6);
  const next = addItem(addAsset(timeline, asset), item);
  return { timeline: next, changedItemIds: [item.id] };
};

export const setVolumeEdit = (
  timeline: Timeline,
  input: { itemId?: string; trackId?: string; volume?: number; muted?: boolean },
): EditChange => {
  if (input.trackId) {
    const track = findTrack(timeline, input.trackId);
    if (!track) throw new Error("That track is not on the timeline.");
    return {
      timeline: patchTrack(timeline, input.trackId, { muted: input.muted ?? !track.muted }),
      changedItemIds: track.items.map((item) => item.id),
    };
  }
  if (!input.itemId || input.volume == null) throw new Error("Pass an item and a volume, or a track to mute.");
  const found = requireItem(timeline, input.itemId);
  if (found.item.kind !== "audio" && found.item.kind !== "video") throw new Error("Only audio and video have volume.");
  return {
    timeline: patchItem(timeline, input.itemId, { volume: input.volume }),
    changedItemIds: [input.itemId],
  };
};

export const addCaptionsEdit = (
  timeline: Timeline,
  lines: { text: string; startSec: number; endSec: number }[],
): EditChange => {
  const usable = lines.filter((line) => line.text.trim() && line.endSec > line.startSec);
  if (usable.length === 0) throw new Error("There is no speech to caption.");
  let next = timeline;
  const changedItemIds: string[] = [];
  for (const line of usable) {
    const item = createTextItem(frames(line.startSec), line.text.trim());
    item.durationInFrames = Math.max(1, frames(line.endSec) - item.from);
    item.style = { ...defaultTextStyle(), fontSize: 42, background: "rgba(0,0,0,0.55)" };
    item.transform = { ...item.transform, y: positionY.bottom };
    next = addItem(next, item);
    changedItemIds.push(item.id);
  }
  return { timeline: next, changedItemIds };
};

/** Spreads a transcript across the video, a few words at a time. */
export const captionLinesFromTranscript = (text: string, durationSec: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || durationSec <= 0) return [];
  const lines: { text: string; startSec: number; endSec: number }[] = [];
  const size = 4;
  for (let index = 0; index < words.length; index += size) {
    lines.push({ text: words.slice(index, index + size).join(" "), startSec: 0, endSec: 0 });
  }
  const slice = durationSec / lines.length;
  return lines.map((line, index) => ({
    text: line.text,
    startSec: Math.round(index * slice * 100) / 100,
    endSec: Math.round((index + 1) * slice * 100) / 100,
  }));
};
