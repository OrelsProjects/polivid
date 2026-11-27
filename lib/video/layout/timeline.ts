import {
  defaultTransform,
  type Asset,
  type AudioItem,
  type Focus,
  type ImageItem,
  type LayoutTag,
  type Region,
  type SceneItem,
  type TextItem,
  type TextStyle,
  type Timeline,
  type VideoItem,
} from "@/lib/editor/schema";
import { dimensionsFor, FPS, type VideoFormat } from "@/lib/video/schema";
import { captionLines, type LayoutBeat } from "./beats";
import type { BeatPlan } from "./rules";
import type { LayoutName, LayoutStyle } from "./styles";

/** The picture or clip a beat shows: an upload, or a picture drawn for it. */
export interface BeatMedia {
  key: string;
  kind: "image" | "video";
}

/** How a picture or clip is placed in its layout. Pictures and clips take the same placement. */
type MediaPlacement = Partial<Pick<ImageItem, "region" | "radius" | "motion" | "transform" | "focus">>;

/** Where the person's face sits in the take, when nothing better is known. */
export const DEFAULT_FACE: Focus = { x: 50, y: 35 };

/** How far avatar-close punches in. A hard cut, not a zoom. */
export const CLOSE_SCALE = 1.3;

export const HIGHLIGHT_COLOR = "#FFD400";

/** A punch-in cutaway covers at most this much of its beat. */
const CUTAWAY_FRAMES = 2 * FPS;

/**
 * Beats in a row that show the same upload the same way become one clip, so a post keeps panning
 * and a recording keeps playing instead of restarting at every beat. The take is never merged:
 * each beat's cut keeps its own layout.
 */
const mergeHeld = <T extends ImageItem | VideoItem | SceneItem>(items: T[]): T[] => {
  const merged: T[] = [];
  for (const item of items) {
    const previous = merged.at(-1);
    const same =
      previous &&
      previous.kind === item.kind &&
      (previous.kind === "image" || previous.kind === "video") &&
      (item.kind === "image" || item.kind === "video") &&
      previous.assetId === item.assetId &&
      previous.assetId !== "take" &&
      previous.from + previous.durationInFrames === item.from &&
      previous.layout?.name === item.layout?.name &&
      JSON.stringify([previous.region, previous.radius, previous.transform]) === JSON.stringify([item.region, item.radius, item.transform]) &&
      (previous.kind !== "video" || item.kind !== "video" || previous.trimStart + previous.durationInFrames === item.trimStart);
    if (same) {
      merged[merged.length - 1] = { ...previous, durationInFrames: previous.durationInFrames + item.durationInFrames };
      continue;
    }
    merged.push(item);
  }
  return merged;
};

const CAPTION_SIZE: Record<VideoFormat, number> = { "9:16": 76, "1:1": 64, "16:9": 58 };

type TrackItems = Timeline["tracks"][number]["items"];

const track = (id: string, kind: "visual" | "text" | "audio", name: string, items: TrackItems) => ({
  id,
  kind,
  name,
  muted: false,
  hidden: false,
  locked: false,
  items,
});

const frameAt = (seconds: number) => Math.max(0, Math.round(seconds * FPS));

/** Regions for each layout, by frame shape. A split is stacked in tall frames and side by side in wide ones. */
export const layoutRegions = (format: VideoFormat) => {
  const { width, height } = dimensionsFor(format);
  const wide = format === "16:9";
  // A square bubble: its width in percent of the frame width, and the same pixels in percent of the height.
  const bubbleWidth = wide ? 22 : 36;
  const bubbleHeight = (bubbleWidth * width) / height;
  return {
    splitPicture: (wide ? { x: 0, y: 0, w: 50, h: 100 } : { x: 0, y: 0, w: 100, h: 50 }) satisfies Region,
    splitAvatar: (wide ? { x: 50, y: 0, w: 50, h: 100 } : { x: 0, y: 50, w: 100, h: 50 }) satisfies Region,
    card: (wide ? { x: 18, y: 10, w: 64, h: 66 } : { x: 8, y: 14, w: 84, h: 52 }) satisfies Region,
    bubble: { x: 100 - bubbleWidth - 5, y: 100 - bubbleHeight - (wide ? 6 : 13), w: bubbleWidth, h: bubbleHeight } satisfies Region,
    window: (wide ? { x: 10, y: 10, w: 80, h: 72 } : { x: 6, y: 20, w: 88, h: 50 }) satisfies Region,
    framedBand: (wide ? { x: 20, y: 20, w: 60, h: 56 } : { x: 0, y: 24, w: 100, h: 44 }) satisfies Region,
    /**
     * A sketch on a paper card over the speaker: beside them in a wide frame, across the top of a
     * tall one, over the hair and the wall, so the eyes and mouth stay clear and the captions sit below.
     */
    sketchCard: (wide ? { x: 52, y: 8, w: 44, h: 60 } : format === "1:1" ? { x: 6, y: 4, w: 88, h: 32 } : { x: 5, y: 4, w: 90, h: 27 }) satisfies Region,
  };
};

/** Caption height for each layout, as `y` in percent below the centre of the frame. */
const captionY = (layout: LayoutName, format: VideoFormat, overVideo = false) => {
  if (format === "16:9") return layout === "window" ? 40 : 34;
  // Over a speaker the card is at the top, so the captions keep their usual place under the face.
  if (layout === "sketch" && overVideo) return 26;
  if (layout === "split") return 0;
  // Clear of the round bubble in the lower corner: just under the middle over a post,
  // and in the band above the window on a screen.
  if (layout === "bubble") return 6;
  if (layout === "window") return -38;
  if (layout === "sketch") return 34;
  if (layout === "framed") return 25;
  if (layout === "card") return 30;
  return 26;
};

const captionStyle = (format: VideoFormat): TextStyle => ({
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: CAPTION_SIZE[format],
  fontWeight: 900,
  color: "#FFFFFF",
  background: null,
  align: "center",
  uppercase: true,
  outline: { color: "#000000", width: 10 },
});

/** Captions on paper: dark ink on a soft white card, so they read on the light backdrop. */
const paperCaptionStyle = (format: VideoFormat): TextStyle => ({
  fontFamily: "'Lexend', sans-serif",
  fontSize: CAPTION_SIZE[format] * 0.72,
  fontWeight: 700,
  color: "#1F2937",
  background: "rgba(255,255,255,0.88)",
  align: "center",
  radius: 18,
});

const pillStyle = (format: VideoFormat, fontSize = CAPTION_SIZE[format] * 0.72): TextStyle => ({
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize,
  fontWeight: 800,
  color: "#111111",
  background: HIGHLIGHT_COLOR,
  align: "center",
  radius: 400,
});

const textItem = (input: {
  id: string;
  text: string;
  from: number;
  frames: number;
  style: TextStyle;
  y: number;
  layout: LayoutTag;
  pop?: boolean;
  highlight?: string;
  role?: "caption";
  /** When each word is said, in seconds of the take. */
  words?: readonly { text: string; start: number; end: number }[];
}): TextItem => ({
  id: input.id,
  kind: "text",
  ...(input.role ? { role: input.role } : {}),
  text: input.text,
  from: input.from,
  durationInFrames: Math.max(1, input.frames),
  transitionIn: null,
  transitionOut: null,
  style: input.style,
  transform: { ...defaultTransform(), y: input.y },
  animationIn: input.pop ? { type: "pop", durationInFrames: 6 } : { type: "none", durationInFrames: 0 },
  animationOut: { type: "none", durationInFrames: 0 },
  ...(input.highlight ? { highlight: { text: input.highlight, color: HIGHLIGHT_COLOR } } : {}),
  ...(input.words?.length
    ? {
        words: input.words.map((word) => {
          const from = Math.max(0, frameAt(word.start) - input.from);
          return { text: word.text, from, to: Math.max(from, frameAt(word.end) - input.from) };
        }),
      }
    : {}),
  layout: input.layout,
});

/**
 * The edit for a layout-style video. Everything is ordinary timeline items, so it opens in the
 * editor like any project: the take is cut at beat boundaries (same clip, trimStart following the
 * timeline, so lips stay on the words), muted, with its sound on the voice track underneath.
 * Each beat's pictures, take, captions, and labels carry a layout tag naming the beat and its layout.
 */
export const buildLayoutTimeline = (input: {
  format: VideoFormat;
  style: LayoutStyle;
  /** The finished video this is made from. Its sound is the voice. */
  source: { videoId: string; seconds: number };
  /** Set when that video is one take of a speaker, which the layouts cut and frame. A sketch has none. */
  take?: { focus: Focus };
  beats: readonly LayoutBeat[];
  plans: readonly BeatPlan[];
  /** What each beat shows, when its layout shows something. */
  media: readonly (BeatMedia | null)[];
  captions: boolean;
  /** Name and headline across the top of a framed layout. */
  header?: { name: string; headline: string };
}): Timeline => {
  const { format, style, take, source } = input;
  const regions = layoutRegions(format);
  const total = frameAt(Math.max(source.seconds, input.beats.at(-1)?.end ?? 0));
  const assets: Asset[] = take
    ? [{ id: "take", kind: "video", source: { type: "video", videoId: source.videoId }, name: "Avatar take", durationInFrames: total, width: null, height: null }]
    : [];
  const backdrop: (ImageItem | VideoItem)[] = [];
  const pictures: (ImageItem | VideoItem | SceneItem)[] = [];
  const avatar: VideoItem[] = [];
  const over: (ImageItem | VideoItem | SceneItem)[] = [];
  const captions: TextItem[] = [];
  const labels: TextItem[] = [];
  /** How far into each uploaded clip earlier beats already played, so a recording runs on instead of restarting. */
  const clipUsed = new Map<string, number>();
  const assetFor = (media: BeatMedia) => {
    const id = `media-${assets.length}`;
    const existing = assets.find((asset) => asset.source.type === "upload" && asset.source.key === media.key);
    if (existing) return existing.id;
    assets.push({ id, kind: media.kind, source: { type: "upload", key: media.key }, name: media.kind === "video" ? "Your clip" : "Picture", durationInFrames: null, width: null, height: null });
    return id;
  };
  if (input.plans.some((plan) => plan.layout === "window")) {
    assets.push({ id: "backdrop-dusk", kind: "image", source: { type: "library", id: "dusk" }, name: "Dusk gradient", durationInFrames: null, width: null, height: null });
  }
  // Over a speaker's take, a sketch is a paper card on the video. With no take, the page fills the frame.
  if (!take && input.plans.some((plan) => plan.layout === "sketch")) {
    assets.push({ id: "backdrop-paper", kind: "image", source: { type: "library", id: "paper" }, name: "Paper", durationInFrames: null, width: null, height: null });
  }
  const sketch = style.id === "sketch-explainer";
  /** Captions sit on paper only when there's no take: over a speaker they read like any caption. */
  const paperCaptions = sketch && !take;

  input.beats.forEach((beat, index) => {
    const plan = input.plans[index];
    const from = frameAt(beat.start);
    const frames = Math.max(1, (index === input.beats.length - 1 ? total : frameAt(beat.end)) - from);
    const tag = (role: string): LayoutTag => ({ style: style.id, beat: index, name: plan.layout, role });
    const base = { from, durationInFrames: frames, transitionIn: null, transitionOut: null };

    const takeCut = (role: string, extra: Partial<VideoItem> = {}): VideoItem => {
      if (!take) throw new Error(`${style.title} needs a video with one take of the speaker.`);
      return {
      id: `take-${index}-${role}`,
      kind: "video",
      assetId: "take",
      ...base,
      // The timeline starts where the take starts, so the cut plays the same moment it covers.
      trimStart: from,
      volume: 0,
      transform: defaultTransform(),
      opacity: 1,
      focus: take.focus,
      layout: tag(role),
      ...extra,
      };
    };

    const media = input.media[index];
    const shown = (role: string, extra: MediaPlacement = {}): ImageItem | VideoItem | null => {
      if (!media) return null;
      const assetId = assetFor(media);
      if (media.kind === "video") {
        const used = clipUsed.get(media.key) ?? 0;
        clipUsed.set(media.key, used + frames);
        const clip: VideoItem = { id: `media-${index}-${role}`, kind: "video", assetId, ...base, trimStart: used, volume: 0, transform: defaultTransform(), opacity: 1, layout: tag(role), ...extra };
        return clip;
      }
      const picture: ImageItem = { id: `media-${index}-${role}`, kind: "image", assetId, ...base, transform: defaultTransform(), opacity: 1, layout: tag(role), ...extra };
      return picture;
    };

    switch (plan.layout) {
      case "split": {
        const picture = shown("picture", { region: regions.splitPicture, motion: { kind: index % 2 ? "zoom-out" : "zoom-in", amount: 0.08 } });
        if (picture) pictures.push(picture);
        avatar.push(takeCut("avatar", { region: regions.splitAvatar }));
        break;
      }
      case "avatar":
        avatar.push(takeCut("avatar"));
        break;
      case "avatar-close":
        avatar.push(takeCut("avatar", { transform: { ...defaultTransform(), scale: CLOSE_SCALE } }));
        break;
      case "picture": {
        const picture = shown("picture", { motion: { kind: "zoom-in", amount: 0.1 } });
        if (picture && style.id === "punch-in") {
          // A cutaway: the take keeps running underneath, and the picture covers only the start of the beat.
          avatar.push(takeCut("avatar"));
          over.push({ ...picture, durationInFrames: Math.min(frames, CUTAWAY_FRAMES) });
        } else if (picture) {
          pictures.push(picture);
        }
        break;
      }
      case "card": {
        const picture = shown("card", { region: regions.card, radius: 4, transform: { ...defaultTransform(), fit: "contain" } });
        if (picture) pictures.push(picture);
        break;
      }
      case "bubble": {
        const picture = shown("picture", { motion: { kind: "pan-up", amount: 0.1 } });
        if (picture) pictures.push(picture);
        over.push(takeCut("bubble", { region: regions.bubble, radius: 50 }));
        break;
      }
      case "window": {
        backdrop.push({ id: `backdrop-${index}`, kind: "image", assetId: "backdrop-dusk", ...base, transform: defaultTransform(), opacity: 1, layout: tag("backdrop") });
        const picture = shown("window", { region: regions.window, radius: 4, motion: { kind: "zoom-in", amount: 0.08 } });
        if (picture) pictures.push(picture);
        if (style.id === "screen-demo") over.push(takeCut("bubble", { region: regions.bubble, radius: 50 }));
        break;
      }
      case "framed":
        avatar.push(takeCut("avatar", { region: regions.framedBand }));
        break;
      case "endcard":
        // The call to action, said as the card shows it. The words are the card, so no captions run under it.
        labels.push(
          textItem({
            id: `endcard-${index}`,
            text: beat.say,
            from,
            frames,
            style: { ...captionStyle(format), fontSize: CAPTION_SIZE[format] * 1.1, outline: undefined },
            y: 0,
            layout: tag("endcard"),
            pop: true,
            highlight: plan.highlight,
          }),
        );
        break;
      case "sketch":
        if (take) {
          // The speaker stays on screen. The hook is theirs alone; every later beat draws its card over them.
          avatar.push(takeCut("avatar"));
          if (plan.sketch && (index > 0 || input.beats.length <= 2)) {
            over.push({
              id: `sketch-${index}`,
              kind: "scene",
              ...base,
              scene: { type: "text", headline: plan.sketch.headline, narration: "", factIds: [], quote: null, durationSec: Math.min(12, Math.max(2, Number((frames / FPS).toFixed(2)))) },
              facts: [],
              quotes: [],
              trimStart: 0,
              sketch: plan.sketch,
              region: regions.sketchCard,
              radius: 6,
              layout: tag("sketch"),
            });
          }
          break;
        }
        backdrop.push({ id: `backdrop-${index}`, kind: "image", assetId: "backdrop-paper", ...base, transform: defaultTransform(), opacity: 1, layout: tag("backdrop") });
        if (plan.sketch) {
          pictures.push({
            id: `sketch-${index}`,
            kind: "scene",
            ...base,
            scene: { type: "text", headline: plan.sketch.headline, narration: "", factIds: [], quote: null, durationSec: Math.min(12, Math.max(2, Number(((frames) / FPS).toFixed(2)))) },
            facts: [],
            quotes: [],
            trimStart: 0,
            sketch: plan.sketch,
            layout: tag("sketch"),
          });
        }
        break;
    }

    if (input.captions && plan.layout !== "endcard") {
      for (const [line, caption] of captionLines(beat, style.captionWords).entries()) {
        const start = frameAt(caption.start);
        const end = frameAt(caption.end);
        captions.push(
          textItem({
            id: `caption-${index}-${line}`,
            text: caption.text,
            from: Math.max(from, start),
            frames: Math.min(from + frames, end) - Math.max(from, start),
            style: paperCaptions ? paperCaptionStyle(format) : captionStyle(format),
            y: captionY(plan.layout, format, Boolean(take)),
            layout: tag("caption"),
            pop: true,
            highlight: plan.highlight && caption.text.toLowerCase().includes(plan.highlight.toLowerCase()) ? plan.highlight : undefined,
            role: "caption",
            words: caption.words,
          }),
        );
      }
    }
    if (plan.stat) {
      const y = plan.layout === "card" ? (format === "16:9" ? 33 : 22) : format === "16:9" ? -38 : -34;
      labels.push(textItem({ id: `stat-${index}`, text: plan.stat, from, frames, style: pillStyle(format), y, layout: tag("stat"), pop: true }));
    }
  });

  if (input.header && input.plans.some((plan) => plan.layout === "framed")) {
    const framed = { style: style.id, beat: 0, name: "framed", role: "header" } satisfies LayoutTag;
    // The header stays up while the band does, and gives way to the end card.
    const card = input.plans.findIndex((plan) => plan.layout === "endcard");
    const until = card > 0 ? frameAt(input.beats[card].start) : total;
    const headerItems = [
      input.header.name
        ? textItem({ id: "header-name", text: input.header.name, from: 0, frames: until, style: { ...captionStyle(format), uppercase: false, outline: undefined, fontSize: CAPTION_SIZE[format] * 0.62, fontWeight: 800 }, y: -40, layout: framed })
        : null,
      input.header.headline
        ? textItem({ id: "header-headline", text: input.header.headline, from: 0, frames: until, style: { ...captionStyle(format), uppercase: false, outline: undefined, fontSize: CAPTION_SIZE[format] * 0.7, fontWeight: 700, color: "#E5E7EB" }, y: -32, layout: framed })
        : null,
    ];
    labels.push(...headerItems.filter((item): item is TextItem => item !== null));
  }

  const voice: AudioItem = {
    id: "voice-item",
    kind: "audio",
    role: "voice",
    assetId: "voice",
    from: 0,
    durationInFrames: Math.max(1, total),
    transitionIn: null,
    transitionOut: null,
    trimStart: 0,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
  };
  assets.push({ id: "voice", kind: "audio", source: { type: "video", videoId: source.videoId }, name: "Voice", durationInFrames: total, width: null, height: null });

  return {
    version: 1,
    format,
    tracks: [
      ...(backdrop.length ? [track("backdrop", "visual", "Backdrop", backdrop)] : []),
      track("pictures", "visual", "Pictures", mergeHeld(pictures)),
      ...(avatar.length ? [track("avatar", "visual", "Avatar", avatar)] : []),
      ...(over.length ? [track("over", "visual", "Over", mergeHeld(over))] : []),
      track("captions", "text", "Captions", captions),
      ...(labels.length ? [track("labels", "text", "Labels", labels)] : []),
      track("voice", "audio", "Voice", [voice]),
    ],
    assets,
  };
};
