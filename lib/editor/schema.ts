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

export const TEXT_ANIMATIONS = ["none", "fade", "slide", "pop"] as const;
export type TextAnimationType = (typeof TEXT_ANIMATIONS)[number];

export const AssetSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("upload"), key: z.string().min(1) }),
  z.object({
    type: z.literal("video"),
    videoId: z.string().min(1),
    /** `source` is the filmed clip before a voice was added. Omitted means the finished file. */
    layer: z.literal("source").optional(),
  }),
  z.object({ type: z.literal("voice"), videoId: z.string().min(1) }),
  z.object({ type: z.literal("production"), assetId: z.string().min(1) }),
  z.object({ type: z.literal("song"), songId: z.string().min(1) }),
  /** A clip that ships with the app, such as a background loop. */
  z.object({ type: z.literal("library"), id: z.string().min(1).max(60) }),
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

/**
 * Where a picture or clip sits, as a box in percent of the frame: x and y are its top-left corner.
 * The media covers that box and is clipped to it. Unset means the whole frame.
 */
export const RegionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
});
export type Region = z.infer<typeof RegionSchema>;

/** The point of a picture or clip that stays in view when it is cropped, and that a zoom moves toward. Percent of the media. */
export const FocusSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});
export type Focus = z.infer<typeof FocusSchema>;

/** Corner rounding of a region, in percent of its shorter side. 50 makes a circle of a square box. */
export const RadiusSchema = z.number().min(0).max(50);

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

/** A line drawn around each letter, in pixels of the finished frame. */
export const TextOutlineSchema = z.object({
  color: z.string().min(1),
  width: z.number().min(0).max(20),
});
export type TextOutline = z.infer<typeof TextOutlineSchema>;

export const TextStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontSize: z.number().min(8).max(400),
  fontWeight: z.number().int().min(100).max(900),
  color: z.string().min(1),
  background: z.string().nullable(),
  align: z.enum(TEXT_ALIGNS),
  /** Shown in capitals. The text itself keeps its case. */
  uppercase: z.boolean().optional(),
  outline: TextOutlineSchema.optional(),
  /** Corner rounding of the background, in pixels. A large value makes a pill. */
  radius: z.number().min(0).max(400).optional(),
  italic: z.boolean().optional(),
  /** Extra space between letters, in pixels. */
  letterSpacing: z.number().min(-10).max(40).optional(),
  /** A CSS text-shadow, such as a soft glow or a hard drop shadow. */
  shadow: z.string().max(200).optional(),
  /** How the word being spoken stands out. Needs the caption's word timing; without it words are spread evenly. */
  activeWord: z
    .object({
      color: z.string().min(1).optional(),
      background: z.string().min(1).optional(),
      /** 1 is unchanged. */
      scale: z.number().min(0.5).max(2).optional(),
    })
    .optional(),
  /**
   * How words not yet spoken look: 0 hides them, so words appear as they are said; between 0 and 1
   * dims them, like karaoke. Unset shows every word from the start.
   */
  upcomingOpacity: z.number().min(0).max(1).optional(),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextAnimationSchema = z.object({
  type: z.enum(TEXT_ANIMATIONS),
  durationInFrames: z.number().int().min(0).max(90),
});
export type TextAnimation = z.infer<typeof TextAnimationSchema>;

export const CaptionWordSchema = z.object({
  text: z.string().min(1).max(80),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
});
export type CaptionWord = z.infer<typeof CaptionWordSchema>;

export const TextHighlightSchema = z.object({
  text: z.string().min(1).max(80),
  color: z.string().min(1),
});
export type TextHighlight = z.infer<typeof TextHighlightSchema>;

/**
 * Marks the items a layout style placed for one beat, so the beat can be rearranged together.
 * `name` is the layout of that beat, `role` what this item is in it. Items without it are left alone.
 */
export const LayoutTagSchema = z.object({
  style: z.string().min(1).max(40),
  beat: z.number().int().min(0),
  name: z.string().min(1).max(40),
  role: z.string().min(1).max(40),
});
export type LayoutTag = z.infer<typeof LayoutTagSchema>;

const ItemBaseSchema = {
  id: z.string().min(1),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().min(1),
  transitionIn: TransitionSchema.nullable(),
  transitionOut: TransitionSchema.nullable(),
};

export const IMAGE_MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"] as const;
export type ImageMotionKind = (typeof IMAGE_MOTIONS)[number];

/** A slow camera move over a still. `amount` is how far it travels, as a share of the frame. */
export const ImageMotionSchema = z.object({
  kind: z.enum(IMAGE_MOTIONS),
  amount: z.number().min(0).max(0.5),
});
export type ImageMotion = z.infer<typeof ImageMotionSchema>;

export const VideoItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("video"),
  assetId: z.string().min(1),
  trimStart: z.number().int().min(0),
  volume: z.number().min(0).max(2),
  transform: TransformSchema,
  opacity: z.number().min(0).max(1),
  region: RegionSchema.optional(),
  focus: FocusSchema.optional(),
  radius: RadiusSchema.optional(),
  /** A slow camera move over the clip, the same moves a still can make. */
  motion: ImageMotionSchema.optional(),
  layout: LayoutTagSchema.optional(),
});
export type VideoItem = z.infer<typeof VideoItemSchema>;

export const ImageItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("image"),
  assetId: z.string().min(1),
  transform: TransformSchema,
  opacity: z.number().min(0).max(1),
  motion: ImageMotionSchema.optional(),
  region: RegionSchema.optional(),
  focus: FocusSchema.optional(),
  radius: RadiusSchema.optional(),
  layout: LayoutTagSchema.optional(),
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

/** Marks text the editor made as captions, so they can be restyled or removed together. Unset is a plain title. */
export const TEXT_ROLES = ["caption"] as const;
export type TextRole = (typeof TEXT_ROLES)[number];

/** What an audio clip is for. Unset is any other sound. */
export const AUDIO_ROLES = ["music", "sfx", "voice"] as const;
export type AudioRole = (typeof AUDIO_ROLES)[number];

export const TextItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("text"),
  role: z.enum(TEXT_ROLES).optional(),
  text: z.string(),
  style: TextStyleSchema,
  transform: TransformSchema,
  animationIn: TextAnimationSchema,
  animationOut: TextAnimationSchema,
  /** One word or phrase in the text drawn in a second color. */
  highlight: TextHighlightSchema.optional(),
  /** When each word is spoken, in frames from the start of this clip. Set on captions made from timed speech. */
  words: z.array(CaptionWordSchema).max(200).optional(),
  layout: LayoutTagSchema.optional(),
});
export type TextItem = z.infer<typeof TextItemSchema>;

export const AudioItemSchema = z.object({
  ...ItemBaseSchema,
  kind: z.literal("audio"),
  role: z.enum(AUDIO_ROLES).optional(),
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
