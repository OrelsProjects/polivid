import { FPS } from "@/lib/video/schema";
import type { VideoFormat } from "@/lib/video/schema";
import { coverFrame } from "./framing";
import {
  addAsset,
  addItem,
  addTrack,
  createAudioItem,
  createImageItem,
  createTextItem,
  createVideoItem,
  deleteItem,
  duplicateItem,
  moveItem,
  patchItem,
  patchTrack,
  removeTrack,
  reorderTracks,
  rippleDelete,
  setCrossfade,
  setFormat,
  splitItem,
  trimItem,
} from "./operations";
import {
  assetById,
  defaultTextStyle,
  findItem,
  findTrack,
  hasTrimStart,
  newId,
  timelineDurationInFrames,
  type Asset,
  type AudioRole,
  type FitMode,
  type ImageMotionKind,
  type TextAlign,
  type TextAnimationType,
  type TextItem,
  type TextStyle,
  type Timeline,
  type TimelineItem,
  type TrackKind,
  type Transform,
  type TransitionType,
} from "./schema";

export type TextPosition = "top" | "center" | "bottom";

export interface EditChange {
  timeline: Timeline;
  changedItemIds: string[];
}

export interface TimelineReading {
  durationSec: number;
  format: string;
  tracks: {
    id: string;
    kind: string;
    name: string;
    muted: boolean;
    hidden: boolean;
    locked: boolean;
    items: {
      id: string;
      kind: string;
      startSec: number;
      endSec: number;
      text?: string;
      name?: string;
      /** Present on video and audio clips. 0 is silent. */
      volume?: number;
      /** `footage` is the filmed clip's own sound. */
      sound?: "footage";
      /** caption, music, sfx, or voice, when the editor knows. */
      role?: string;
      /** Every property, with times in seconds. Only with detail. */
      props?: Record<string, unknown>;
    }[];
  }[];
  /** Media on the timeline. Only with detail. */
  assets?: { id: string; kind: string; name: string; durationSec: number | null; source: string }[];
}

const seconds = (frames: number) => Math.round((frames / FPS) * 100) / 100;
const frames = (value: number) => Math.max(0, Math.round(value * FPS));

const positionY: Record<TextPosition, number> = { top: -28, center: 0, bottom: 32 };

/** How edit_add_captions draws a line. Older projects have captions like this with no role. */
export const CAPTION_STYLE = { fontSize: 42, background: "rgba(0,0,0,0.55)" } as const;

/** Captions are marked by role. Captions added before roles existed are recognised by their style. */
export const isCaption = (item: TimelineItem): item is TextItem =>
  item.kind === "text" &&
  (item.role === "caption" ||
    (item.role === undefined && item.style.fontSize === CAPTION_STYLE.fontSize && item.style.background === CAPTION_STYLE.background));

const roleOf = (item: TimelineItem) => {
  if (isCaption(item)) return "caption";
  if (item.kind === "audio") return item.role;
  return undefined;
};

const requireItem = (timeline: Timeline, itemId: string) => {
  const found = findItem(timeline, itemId);
  if (!found) throw new Error("That clip is not on the timeline. Read the timeline and use an id from it.");
  return found;
};

const footageSound = (timeline: Timeline, item: TimelineItem) => {
  if (item.kind !== "video") return false;
  const source = assetById(timeline, item.assetId)?.source;
  return source?.type === "video" && source.layer === "source";
};

const itemName = (timeline: Timeline, item: TimelineItem) => {
  if (item.kind === "text") return item.text;
  if (item.kind === "scene") return item.scene.headline;
  if (item.kind === "video" || item.kind === "image" || item.kind === "audio") {
    return assetById(timeline, item.assetId)?.name;
  }
  return undefined;
};

const transitionView = (value: { type: string; durationInFrames: number } | null) =>
  value ? { type: value.type, seconds: seconds(value.durationInFrames) } : null;

/** Every editable property of one clip, in seconds, for agents that need more than the map. */
export const itemProps = (item: TimelineItem): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    transitionIn: transitionView(item.transitionIn),
    transitionOut: transitionView(item.transitionOut),
  };
  if (hasTrimStart(item)) base.trimStartSec = seconds(item.trimStart);
  if (item.kind === "video") Object.assign(base, { assetId: item.assetId, volume: item.volume, opacity: item.opacity, transform: item.transform });
  if (item.kind === "image") Object.assign(base, { assetId: item.assetId, opacity: item.opacity, transform: item.transform, motion: item.motion ?? null });
  if (item.kind === "text") {
    Object.assign(base, {
      style: item.style,
      transform: item.transform,
      animationIn: transitionView(item.animationIn),
      animationOut: transitionView(item.animationOut),
    });
  }
  if (item.kind === "audio") {
    Object.assign(base, { assetId: item.assetId, volume: item.volume, fadeInSec: seconds(item.fadeIn), fadeOutSec: seconds(item.fadeOut) });
  }
  if (item.kind === "scene") Object.assign(base, { scene: item.scene });
  return base;
};

const sourceLabel = (asset: Asset) => {
  const source = asset.source;
  if (source.type === "upload") return `upload:${source.key}`;
  if (source.type === "video") return `video:${source.videoId}${source.layer ? `:${source.layer}` : ""}`;
  if (source.type === "voice") return `voice:${source.videoId}`;
  if (source.type === "production") return `production:${source.assetId}`;
  if (source.type === "song") return `song:${source.songId}`;
  return `library:${source.id}`;
};

/** A short map the Coach can quote back. Times are seconds. `detail` adds every property and the assets. */
export const readTimeline = (timeline: Timeline, options: { detail?: boolean } = {}): TimelineReading => ({
  durationSec: seconds(timelineDurationInFrames(timeline)),
  format: timeline.format,
  ...(options.detail
    ? {
        assets: timeline.assets.map((asset) => ({
          id: asset.id,
          kind: asset.kind,
          name: asset.name,
          durationSec: asset.durationInFrames == null ? null : seconds(asset.durationInFrames),
          source: sourceLabel(asset),
        })),
      }
    : {}),
  tracks: timeline.tracks.map((track) => ({
    id: track.id,
    kind: track.kind,
    name: track.name,
    muted: track.muted,
    hidden: track.hidden,
    locked: track.locked,
    items: track.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      startSec: seconds(item.from),
      endSec: seconds(item.from + item.durationInFrames),
      text: item.kind === "text" ? item.text : undefined,
      name: itemName(timeline, item),
      ...(item.kind === "video" || item.kind === "audio" ? { volume: item.volume } : {}),
      ...(footageSound(timeline, item) ? { sound: "footage" as const } : {}),
      ...(roleOf(item) ? { role: roleOf(item) } : {}),
      ...(options.detail ? { props: itemProps(item) } : {}),
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

export const moveEdit = (timeline: Timeline, input: { itemId: string; startSec?: number; trackId?: string }): EditChange => {
  const found = requireItem(timeline, input.itemId);
  if (input.trackId && !findTrack(timeline, input.trackId)) throw new Error("That track is not on the timeline.");
  const from = input.startSec != null ? frames(input.startSec) : found.item.from;
  return { timeline: moveItem(timeline, input.itemId, from, input.trackId), changedItemIds: [input.itemId] };
};

export const addMusicEdit = (
  timeline: Timeline,
  asset: Asset,
  input: { startSec?: number; volume?: number; fadeInSec?: number; fadeOutSec?: number; role?: AudioRole; durationSec?: number },
): EditChange => {
  if (asset.kind !== "audio") throw new Error("That file is not audio.");
  const sfx = input.role === "sfx";
  const item = createAudioItem(asset, frames(input.startSec ?? 0));
  item.role = input.role ?? "music";
  item.volume = input.volume ?? (sfx ? 1 : 0.35);
  item.fadeIn = frames(input.fadeInSec ?? (sfx ? 0 : 0.4));
  item.fadeOut = frames(input.fadeOutSec ?? (sfx ? 0 : 0.6));
  if (input.durationSec != null) item.durationInFrames = Math.max(1, frames(input.durationSec));
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
      timeline: patchTrack(timeline, input.trackId, { muted: input.muted ?? true }),
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
    item.style = { ...defaultTextStyle(), ...CAPTION_STYLE };
    item.transform = { ...item.transform, y: positionY.bottom };
    item.role = "caption";
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

// ---------- Project and tracks ----------

export const setFormatEdit = (timeline: Timeline, format: VideoFormat): EditChange => ({
  timeline: setFormat(timeline, format),
  changedItemIds: [],
});

const requireTrack = (timeline: Timeline, trackId: string) => {
  const track = findTrack(timeline, trackId);
  if (!track) throw new Error("That track is not on the timeline. Read the timeline and use a track id from it.");
  return track;
};

export const addTrackEdit = (timeline: Timeline, input: { kind: TrackKind; name?: string; index?: number }): EditChange => {
  let next = addTrack(timeline, input.kind, input.name?.trim() || undefined);
  const added = next.tracks[next.tracks.length - 1];
  if (input.index != null) next = reorderTracks(next, added.id, input.index);
  return { timeline: next, changedItemIds: [], ...{ trackId: added.id } } as EditChange & { trackId: string };
};

export const updateTrackEdit = (
  timeline: Timeline,
  input: { trackId: string; name?: string; muted?: boolean; hidden?: boolean; locked?: boolean },
): EditChange => {
  const track = requireTrack(timeline, input.trackId);
  const patch: { name?: string; muted?: boolean; hidden?: boolean; locked?: boolean } = {};
  if (input.name != null && input.name.trim()) patch.name = input.name.trim().slice(0, 60);
  if (input.muted != null) patch.muted = input.muted;
  if (input.hidden != null) patch.hidden = input.hidden;
  if (input.locked != null) patch.locked = input.locked;
  if (Object.keys(patch).length === 0) throw new Error("Pass name, muted, hidden, or locked.");
  return { timeline: patchTrack(timeline, track.id, patch), changedItemIds: track.items.map((item) => item.id) };
};

export const removeTrackEdit = (timeline: Timeline, input: { trackId: string }): EditChange => {
  const track = requireTrack(timeline, input.trackId);
  return { timeline: removeTrack(timeline, track.id), changedItemIds: track.items.map((item) => item.id) };
};

export const reorderTrackEdit = (timeline: Timeline, input: { trackId: string; index: number }): EditChange => {
  requireTrack(timeline, input.trackId);
  return { timeline: reorderTracks(timeline, input.trackId, input.index), changedItemIds: [] };
};

// ---------- Clips ----------

export const duplicateEdit = (timeline: Timeline, input: { itemId: string; startSec?: number; trackId?: string }): EditChange => {
  const found = requireItem(timeline, input.itemId);
  const before = new Set(found.track.items.map((item) => item.id));
  let next = duplicateItem(timeline, input.itemId);
  const copy = findTrack(next, found.track.id)?.items.find((item) => !before.has(item.id));
  if (!copy) throw new Error("Couldn't copy that clip.");
  if (input.startSec != null || input.trackId) {
    next = moveItem(next, copy.id, input.startSec != null ? frames(input.startSec) : copy.from, input.trackId);
  }
  return { timeline: next, changedItemIds: [copy.id] };
};

export const crossfadeEdit = (timeline: Timeline, input: { firstId: string; secondId: string; seconds?: number }): EditChange => {
  const first = requireItem(timeline, input.firstId);
  const second = requireItem(timeline, input.secondId);
  if (first.track.id !== second.track.id) throw new Error("Both clips must be on the same track.");
  return {
    timeline: setCrossfade(timeline, input.firstId, input.secondId, frames(input.seconds ?? 0.4)),
    changedItemIds: [input.firstId, input.secondId],
  };
};

export type TransitionEdge = "in" | "out" | "both";

export const transitionEdit = (
  timeline: Timeline,
  input: { itemId: string; edge?: TransitionEdge; type: TransitionType | "none"; seconds?: number },
): EditChange => {
  const found = requireItem(timeline, input.itemId);
  if (found.item.kind === "audio") throw new Error("Audio fades in and out instead. Use edit_set_audio.");
  const value =
    input.type === "none"
      ? null
      : { type: input.type, durationInFrames: Math.max(1, Math.min(90, frames(input.seconds ?? 0.4))) };
  const edge = input.edge ?? "both";
  const patch: Partial<TimelineItem> = {};
  if (edge === "in" || edge === "both") patch.transitionIn = value;
  if (edge === "out" || edge === "both") patch.transitionOut = value;
  return { timeline: patchItem(timeline, input.itemId, patch), changedItemIds: [input.itemId] };
};

export const transformEdit = (
  timeline: Timeline,
  input: {
    itemId: string;
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    fit?: FitMode;
    opacity?: number;
    fillFrame?: boolean;
  },
): EditChange => {
  const found = requireItem(timeline, input.itemId);
  const item = found.item;
  if (item.kind !== "video" && item.kind !== "image" && item.kind !== "text") {
    throw new Error("Only video, picture, and text clips can be moved, scaled, or rotated.");
  }
  let transform: Transform = { ...item.transform };
  // Same as the inspector's Fill frame: centred, unscaled, unrotated, covering the frame.
  if (input.fillFrame) transform = { ...transform, x: 0, y: 0, scale: 1, rotation: 0, fit: "cover" };
  if (input.x != null) transform.x = input.x;
  if (input.y != null) transform.y = input.y;
  if (input.scale != null) transform.scale = Math.max(0.05, Math.min(10, input.scale));
  if (input.rotation != null) transform.rotation = input.rotation;
  if (input.fit) transform.fit = input.fit;
  // Video always covers the frame (the renderer and inspector clamp it the same way).
  if (item.kind === "video") transform = coverFrame(transform);
  const patch: Partial<TimelineItem> = { transform };
  if (input.opacity != null) {
    if (item.kind === "text") throw new Error("Text has no opacity. Change its color instead.");
    (patch as { opacity?: number }).opacity = Math.max(0, Math.min(1, input.opacity));
  }
  return { timeline: patchItem(timeline, input.itemId, patch), changedItemIds: [input.itemId] };
};

export interface TextStyleInput {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  /** null clears the box behind the words. */
  background?: string | null;
  align?: TextAlign;
  position?: TextPosition;
  animationIn?: { type: TextAnimationType; seconds?: number };
  animationOut?: { type: TextAnimationType; seconds?: number };
}

const styledText = (item: TextItem, input: TextStyleInput): Partial<TimelineItem> => {
  const style: TextStyle = { ...item.style };
  if (input.fontFamily?.trim()) style.fontFamily = input.fontFamily.trim();
  if (input.fontSize != null) style.fontSize = Math.max(8, Math.min(400, input.fontSize));
  if (input.fontWeight != null) style.fontWeight = Math.max(100, Math.min(900, Math.round(input.fontWeight / 100) * 100));
  if (input.color?.trim()) style.color = input.color.trim();
  if (input.background !== undefined) style.background = input.background === null || input.background.trim() === "" ? null : input.background.trim();
  if (input.align) style.align = input.align;
  const patch: Partial<TextItem> = { style };
  if (input.position) patch.transform = { ...item.transform, y: positionY[input.position] };
  const animation = (value: { type: TextAnimationType; seconds?: number }, current: TextItem["animationIn"]) => ({
    type: value.type,
    durationInFrames: value.type === "none" ? 0 : Math.min(90, frames(value.seconds ?? current.durationInFrames / FPS)),
  });
  if (input.animationIn) patch.animationIn = animation(input.animationIn, item.animationIn);
  if (input.animationOut) patch.animationOut = animation(input.animationOut, item.animationOut);
  return patch as Partial<TimelineItem>;
};

export const styleTextEdit = (timeline: Timeline, input: { itemIds: string[] } & TextStyleInput): EditChange => {
  if (input.itemIds.length === 0) throw new Error("Pass at least one text clip id.");
  let next = timeline;
  for (const itemId of input.itemIds) {
    const found = requireItem(next, itemId);
    if (found.item.kind !== "text") throw new Error(`${itemId} is not a text clip.`);
    next = patchItem(next, itemId, styledText(found.item, input));
  }
  return { timeline: next, changedItemIds: input.itemIds };
};

const captionIds = (timeline: Timeline) => timeline.tracks.flatMap((track) => track.items.filter(isCaption).map((item) => item.id));

export const styleCaptionsEdit = (timeline: Timeline, input: TextStyleInput): EditChange => {
  const itemIds = captionIds(timeline);
  if (itemIds.length === 0) throw new Error("There are no captions on this timeline. Add them with edit_add_captions.");
  return styleTextEdit(timeline, { ...input, itemIds });
};

export const removeCaptionsEdit = (timeline: Timeline): EditChange => {
  const itemIds = captionIds(timeline);
  if (itemIds.length === 0) throw new Error("There are no captions on this timeline.");
  let next = timeline;
  for (const itemId of itemIds) next = deleteItem(next, itemId);
  return { timeline: next, changedItemIds: itemIds };
};

export const audioEdit = (
  timeline: Timeline,
  input: { itemId: string; volume?: number; fadeInSec?: number; fadeOutSec?: number; role?: AudioRole },
): EditChange => {
  const found = requireItem(timeline, input.itemId);
  if (found.item.kind !== "audio" && found.item.kind !== "video") throw new Error("Only audio and video clips have sound.");
  const patch: Record<string, unknown> = {};
  if (input.volume != null) patch.volume = Math.max(0, Math.min(2, input.volume));
  if (found.item.kind === "audio") {
    if (input.fadeInSec != null) patch.fadeIn = frames(input.fadeInSec);
    if (input.fadeOutSec != null) patch.fadeOut = frames(input.fadeOutSec);
    if (input.role) patch.role = input.role;
  } else if (input.fadeInSec != null || input.fadeOutSec != null) {
    throw new Error("Video clips don't fade their sound. Use edit_set_transition for a picture fade, or lower the volume.");
  }
  if (Object.keys(patch).length === 0) throw new Error("Pass volume, fadeInSec, fadeOutSec, or role.");
  return { timeline: patchItem(timeline, input.itemId, patch as Partial<TimelineItem>), changedItemIds: [input.itemId] };
};

export const imageMotionEdit = (
  timeline: Timeline,
  input: { itemId: string; motion: ImageMotionKind | "none"; amount?: number },
): EditChange => {
  const found = requireItem(timeline, input.itemId);
  if (found.item.kind !== "image") throw new Error("Only picture clips have a camera move.");
  const motion = input.motion === "none" ? undefined : { kind: input.motion, amount: Math.max(0, Math.min(0.5, input.amount ?? 0.12)) };
  return { timeline: patchItem(timeline, input.itemId, { motion } as Partial<TimelineItem>), changedItemIds: [input.itemId] };
};

/** Puts a picture, clip, or sound on the timeline. The asset is new; the caller builds it from an upload or a video. */
export const addMediaEdit = (
  timeline: Timeline,
  asset: Asset,
  input: { startSec?: number; durationSec?: number; trackId?: string; role?: AudioRole },
): EditChange => {
  const from = frames(input.startSec ?? 0);
  const item: TimelineItem =
    asset.kind === "image" ? createImageItem(asset, from) : asset.kind === "video" ? createVideoItem(asset, from) : createAudioItem(asset, from);
  if (input.durationSec != null) item.durationInFrames = Math.max(1, frames(input.durationSec));
  if (item.kind === "audio" && input.role) item.role = input.role;
  const next = addItem(addAsset(timeline, asset), item, input.trackId);
  return { timeline: next, changedItemIds: [item.id] };
};

export const newAssetId = () => newId();
