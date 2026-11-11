import {
  defaultTransform,
  type Asset,
  type AssetSource,
  type AudioItem,
  type ImageItem,
  type TextItem,
  type Timeline,
  type VideoItem,
} from "@/lib/editor/schema";
import { FPS, type VideoFormat } from "@/lib/video/schema";
import { captionChunks, motionForStill } from "@/lib/video/stills";

export interface StillBeat {
  /** Upload key of the picture shown during this beat. */
  imageKey: string;
  /** Words spoken during this beat. */
  say: string;
  /** How long the speech for this beat lasts. */
  seconds: number;
  /** Silence held after the words. The picture stays up and no caption shows. */
  pause?: number;
}

const CAPTION_FONT: Record<VideoFormat, number> = { "9:16": 68, "1:1": 60, "16:9": 56 };

/** How far a still travels while it is on screen. */
const STILL_MOTION_AMOUNT = 0.12;

const framesFor = (seconds: number) => Math.max(1, Math.round(seconds * FPS));

/** Frames a beat fills, and how many of them carry its words. The rest is the pause after it. */
const beatFrames = (beat: { seconds: number; pause?: number }) => {
  const frames = framesFor(beat.seconds + Math.max(0, beat.pause ?? 0));
  return { frames, spoken: Math.min(frames, framesFor(beat.seconds)) };
};

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

/** Caption lines for one beat, starting at `from`. `y` is how far below centre they sit, in percent. */
const captionItems = (input: {
  beat: number;
  say: string;
  from: number;
  frames: number;
  fontSize: number;
  y: number;
}): TextItem[] =>
  captionChunks(input.say, input.frames).map((chunk, line) => ({
    id: `caption-${input.beat}-${line}`,
    kind: "text",
    text: chunk.text,
    from: input.from + chunk.from,
    durationInFrames: chunk.frames,
    transitionIn: null,
    transitionOut: null,
    style: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: input.fontSize,
      fontWeight: 800,
      color: "#FFFFFF",
      background: "rgba(8, 10, 18, 0.62)",
      align: "center",
    },
    transform: { ...defaultTransform(), y: input.y },
    animationIn: { type: "none", durationInFrames: 0 },
    animationOut: { type: "none", durationInFrames: 0 },
  }));

const voiceLayer = (jobId: string, frames: number): { asset: Asset; item: AudioItem } => ({
  asset: {
    id: "voice",
    kind: "audio",
    source: { type: "voice", videoId: jobId },
    name: "Voice",
    durationInFrames: frames,
    width: null,
    height: null,
  },
  item: {
    id: "voice-item",
    kind: "audio",
    assetId: "voice",
    from: 0,
    durationInFrames: frames,
    transitionIn: null,
    transitionOut: null,
    trimStart: 0,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
  },
});

/**
 * The edit for an animated-stills video: one moving picture per beat, the voice
 * underneath, and caption lines timed inside each beat. Speech sets every length.
 */
export const buildStillsTimeline = (input: {
  jobId: string;
  format: VideoFormat;
  beats: readonly StillBeat[];
  captions: boolean;
}): Timeline => {
  const assets: Asset[] = [];
  const pictures: ImageItem[] = [];
  const captions: TextItem[] = [];
  let cursor = 0;

  input.beats.forEach((beat, index) => {
    const { frames, spoken } = beatFrames(beat);
    const assetId = `still-${index}`;
    assets.push({
      id: assetId,
      kind: "image",
      source: { type: "upload", key: beat.imageKey },
      name: `Picture ${index + 1}`,
      durationInFrames: null,
      width: null,
      height: null,
    });
    pictures.push({
      id: `still-item-${index}`,
      kind: "image",
      assetId,
      from: cursor,
      durationInFrames: frames,
      transitionIn: null,
      transitionOut: null,
      transform: defaultTransform(),
      opacity: 1,
      motion: { kind: motionForStill(index), amount: STILL_MOTION_AMOUNT },
    });
    if (input.captions) {
      captions.push(
        ...captionItems({ beat: index, say: beat.say, from: cursor, frames: spoken, fontSize: CAPTION_FONT[input.format], y: 30 }),
      );
    }
    cursor += frames;
  });

  const voice = voiceLayer(input.jobId, Math.max(1, cursor));
  assets.push(voice.asset);
  return {
    version: 1,
    format: input.format,
    tracks: [
      track("stills", "visual", "Pictures", pictures),
      track("captions", "text", "Captions", captions),
      track("voice", "audio", "Voice", [voice.item]),
    ],
    assets,
  };
};

export interface LoopBeat {
  /** Words spoken during this beat. */
  say: string;
  /** How long the speech for this beat lasts. */
  seconds: number;
  /** Silence held after the words. No caption shows during it. */
  pause?: number;
}

/** With no picture to keep clear of, captions over a loop are larger and sit in the middle. */
const LOOP_CAPTION_FONT: Record<VideoFormat, number> = { "9:16": 84, "1:1": 72, "16:9": 64 };

/**
 * The edit for narration over a background clip: the clip repeated, silent, for as long
 * as the voice runs, with large captions in the middle of the frame.
 */
export const buildLoopTimeline = (input: {
  jobId: string;
  format: VideoFormat;
  beats: readonly LoopBeat[];
  captions: boolean;
  background: { source: AssetSource; seconds: number; name: string };
}): Timeline => {
  const captions: TextItem[] = [];
  let cursor = 0;
  input.beats.forEach((beat, index) => {
    const { frames, spoken } = beatFrames(beat);
    if (input.captions) {
      captions.push(
        ...captionItems({ beat: index, say: beat.say, from: cursor, frames: spoken, fontSize: LOOP_CAPTION_FONT[input.format], y: 0 }),
      );
    }
    cursor += frames;
  });
  const total = Math.max(1, cursor);

  const pass = framesFor(input.background.seconds);
  const passes: VideoItem[] = [];
  for (let from = 0, index = 0; from < total; from += pass, index += 1) {
    passes.push({
      id: `loop-item-${index}`,
      kind: "video",
      assetId: "loop",
      from,
      durationInFrames: Math.min(pass, total - from),
      transitionIn: null,
      transitionOut: null,
      trimStart: 0,
      // The clip is a backdrop. Its own sound would fight the voice.
      volume: 0,
      transform: defaultTransform(),
      opacity: 1,
    });
  }

  const voice = voiceLayer(input.jobId, total);
  return {
    version: 1,
    format: input.format,
    tracks: [
      track("loop", "visual", "Background", passes),
      track("captions", "text", "Captions", captions),
      track("voice", "audio", "Voice", [voice.item]),
    ],
    assets: [
      {
        id: "loop",
        kind: "video",
        source: input.background.source,
        name: input.background.name,
        durationInFrames: pass,
        width: null,
        height: null,
      },
      voice.asset,
    ],
  };
};

/**
 * The edit for a captioned upload: the person's own video with its sound, and caption
 * lines placed at the times the words are spoken.
 */
export const buildCaptionedTimeline = (input: {
  format: VideoFormat;
  /** Upload key of the video being captioned. */
  videoKey: string;
  seconds: number;
  lines: readonly { text: string; start: number; end: number }[];
}): Timeline => {
  const total = framesFor(input.seconds);
  const captions: TextItem[] = [];
  let previousEnd = 0;
  input.lines.forEach((line, index) => {
    // A line never starts before the one ahead of it ends, and never runs past the video.
    const from = Math.max(previousEnd, Math.round(line.start * FPS));
    if (!line.text.trim() || from >= total) return;
    const until = Math.min(total, Math.max(from + 1, Math.round(line.end * FPS)));
    previousEnd = until;
    captions.push({
      id: `caption-${index}`,
      kind: "text",
      text: line.text.trim(),
      from,
      durationInFrames: until - from,
      transitionIn: null,
      transitionOut: null,
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: CAPTION_FONT[input.format],
        fontWeight: 800,
        color: "#FFFFFF",
        background: "rgba(8, 10, 18, 0.62)",
        align: "center",
      },
      transform: { ...defaultTransform(), y: 30 },
      animationIn: { type: "none", durationInFrames: 0 },
      animationOut: { type: "none", durationInFrames: 0 },
    });
  });
  const picture: VideoItem = {
    id: "source-item",
    kind: "video",
    assetId: "source",
    from: 0,
    durationInFrames: total,
    transitionIn: null,
    transitionOut: null,
    trimStart: 0,
    volume: 1,
    // Keep the whole picture. A caption job must not crop what the person filmed.
    transform: { ...defaultTransform(), fit: "contain" },
    opacity: 1,
  };
  return {
    version: 1,
    format: input.format,
    tracks: [track("source", "visual", "Video", [picture]), track("captions", "text", "Captions", captions)],
    assets: [
      {
        id: "source",
        kind: "video",
        source: { type: "upload", key: input.videoKey },
        name: "Your video",
        durationInFrames: total,
        width: null,
        height: null,
      },
    ],
  };
};
