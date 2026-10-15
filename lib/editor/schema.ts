import { z } from "zod";
import {
  FactSchema,
  FPS,
  SceneSchema,
  SourcedQuoteSchema,
  VIDEO_FORMATS,
  type VideoFormat,
} from "@/lib/video/schema";

export const ASSET_KINDS = ["video", "image", "audio"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const TRACK_KINDS = ["visual", "text", "audio"] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

export const ITEM_KINDS = ["video", "image", "scene", "text", "audio"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const TRANSITION_TYPES = ["fade", "slide", "wipe", "zoom"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const FIT_MODES = ["cover", "contain"] as const;
export type FitMode = (typeof FIT_MODES)[number];

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export const TEXT_ANIMATIONS = ["none", "fade", "slide"] as const;
export type TextAnimationType = (typeof TEXT_ANIMATIONS)[number];

export const AssetSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("upload"), key: z.string().min(1) }),
  z.object({ type: z.literal("video"), videoId: z.string().min(1) }),
]);
export type AssetSource = z.infer<typeof AssetSourceSchema>;

export const AssetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(ASSET_KINDS),
  source: AssetSourceSchema,
  name: z.string(),
  durationInFrames: z.number().int().positive().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const TransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().min(0.05).max(10),
  rotation: z.number(),
  fit: z.enum(FIT_MODES),
});
export type Transform = z.infer<typeof TransformSchema>;

export const TransitionSchema = z.object({
  type: z.enum(TRANSITION_TYPES),
  durationInFrames: z.number().int().min(1).max(90),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const TextStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontSize: z.number().min(8).max(400),
  fontWeight: z.number().int().min(100).max(900),
  color: z.string().min(1),
  background: z.string().nullable(),
  align: z.enum(TEXT_ALIGNS),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextAnimationSchema = z.object({
  type: z.enum(TEXT_ANIMATIONS),
  durationInFrames: z.number().int().min(0).max(90),
});
export type TextAnimation = z.infer<typeof TextAnimationSchema>;

const ItemBaseSchema = {
  id: z.string().min(1),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().min(1),
  transitionIn: TransitionSchema.nullable(),
  transitionOut: TransitionSchema.nullable(),
};

export const VideoItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("video"),
  assetId: z.string().min(1),
  trimStart: z.number().int().min(0),
  volume: z.number().min(0).max(2),
  transform: TransformSchema,
  opacity: z.number().min(0).max(1),
});
export type VideoItem = z.infer<typeof VideoItemSchema>;

export const ImageItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("image"),
  assetId: z.string().min(1),
  transform: TransformSchema,
  opacity: z.number().min(0).max(1),
});
export type ImageItem = z.infer<typeof ImageItemSchema>;

export const SceneItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("scene"),
  scene: SceneSchema,
  facts: z.array(FactSchema),
  quotes: z.array(SourcedQuoteSchema),
  trimStart: z.number().int().min(0),
});
export type SceneItem = z.infer<typeof SceneItemSchema>;

export const TextItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("text"),
  text: z.string(),
  style: TextStyleSchema,
  transform: TransformSchema,
  animationIn: TextAnimationSchema,
  animationOut: TextAnimationSchema,
});
export type TextItem = z.infer<typeof TextItemSchema>;

export const AudioItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("audio"),
  assetId: z.string().min(1),
  trimStart: z.number().int().min(0),
  volume: z.number().min(0).max(2),
  fadeIn: z.number().int().min(0),
  fadeOut: z.number().int().min(0),
});
export type AudioItem = z.infer<typeof AudioItemSchema>;

export const TimelineItemSchema = z.discriminatedUnion("kind", [
  VideoItemSchema,
  ImageItemSchema,
  SceneItemSchema,
  TextItemSchema,
  AudioItemSchema,
]);
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

export const TrackSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(TRACK_KINDS),
  name: z.string(),
  muted: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
  items: z.array(TimelineItemSchema),
});
export type Track = z.infer<typeof TrackSchema>;

export const TimelineSchema = z.object({
  version: z.literal(1),
  format: z.enum(VIDEO_FORMATS),
  tracks: z.array(TrackSchema).min(1),
  assets: z.array(AssetSchema),
});
export type Timeline = z.infer<typeof TimelineSchema>;

export type VisualItem = VideoItem | ImageItem | SceneItem;

export const defaultTransform = (): Transform => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  fit: "cover",
});

export const defaultTextStyle = (): TextStyle => ({
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 72,
  fontWeight: 700,
  color: "#FFFFFF",
  background: null,
  align: "center",
});

export const defaultTextAnimation = (): TextAnimation => ({
  type: "fade",
  durationInFrames: 10,
});

export const newId = () => crypto.randomUUID();

export const makeTrack = (kind: TrackKind, name: string, id = newId()): Track => ({
  id,
  kind,
  name,
  muted: false,
  hidden: false,
  locked: false,
  items: [],
});

export const emptyTimeline = (format: VideoFormat = "9:16"): Timeline => ({
  version: 1,
  format,
  tracks: [makeTrack("visual", "Video"), makeTrack("text", "Text"), makeTrack("audio", "Audio")],
  assets: [],
});

export const timelineDurationInFrames = (timeline: Timeline) => {
  let end = 0;
  for (const track of timeline.tracks) {
    for (const item of track.items) {
      end = Math.max(end, item.from + item.durationInFrames);
    }
  }
  return Math.max(FPS, end);
};

export const trackKindForItem = (kind: ItemKind): TrackKind => {
  if (kind === "text") return "text";
  if (kind === "audio") return "audio";
  return "visual";
};

export const itemFitsTrack = (itemKind: ItemKind, trackKind: TrackKind) =>
  trackKindForItem(itemKind) === trackKind;

export const findItem = (timeline: Timeline, itemId: string) => {
  for (const track of timeline.tracks) {
    const item = track.items.find((entry) => entry.id === itemId);
    if (item) return { track, item };
  }
  return null;
};

export const findTrack = (timeline: Timeline, trackId: string) =>
  timeline.tracks.find((track) => track.id === trackId) ?? null;

export const assetById = (timeline: Timeline, assetId: string) =>
  timeline.assets.find((asset) => asset.id === assetId) ?? null;

export const hasTransform = (item: TimelineItem): item is VideoItem | ImageItem | TextItem =>
  item.kind === "video" || item.kind === "image" || item.kind === "text";

export const hasTrimStart = (item: TimelineItem): item is VideoItem | AudioItem | SceneItem =>
  item.kind === "video" || item.kind === "audio" || item.kind === "scene";
