import type { VideoFormat } from "@/lib/video/schema";
import { bundledFont } from "./caption-fonts";
import { captionWords } from "./caption-words";
import { isCaption } from "./coach-edits";
import {
  defaultTransform,
  newId,
  type CaptionWord,
  type TextAnimation,
  type TextItem,
  type TextStyle,
  type Timeline,
} from "./schema";

export const CAPTION_CATEGORIES = [
  { id: "story", label: "Story" },
  { id: "music", label: "Music & lyrics" },
  { id: "business", label: "Business & ads" },
  { id: "education", label: "Education" },
  { id: "podcast", label: "Podcast" },
  { id: "kids", label: "Kids" },
  { id: "gaming", label: "Gaming" },
] as const;
export type CaptionCategory = (typeof CAPTION_CATEGORIES)[number]["id"];

/** A caption look: the text style, where it sits, how many words a line holds, and how it comes in. */
export interface CaptionPreset {
  id: string;
  name: string;
  categories: readonly CaptionCategory[];
  isNew?: boolean;
  /** Everything about the text but its size, which follows the frame. */
  style: Omit<TextStyle, "fontSize">;
  /** Size as a share of the frame's standard caption size. */
  scale: number;
  /** Percent below the centre of the frame. */
  y: number;
  /** Words on a line. Only used when the captions know when each word is said. */
  maxWords: number;
  animationIn: TextAnimation;
}

/** The standard caption size for each frame, in pixels of the finished video. */
export const CAPTION_BASE_SIZE: Record<VideoFormat, number> = { "9:16": 72, "1:1": 62, "16:9": 54 };

const stack = (family: string) => bundledFont(family)?.stack ?? family;
const NONE: TextAnimation = { type: "none", durationInFrames: 0 };
const POP: TextAnimation = { type: "pop", durationInFrames: 6 };
const FADE: TextAnimation = { type: "fade", durationInFrames: 6 };
const black = (width: number) => ({ color: "#000000", width });

const preset = (
  id: string,
  name: string,
  categories: CaptionCategory[],
  style: Partial<Omit<TextStyle, "fontSize">> & { fontFamily: string; fontWeight: number },
  options: Partial<Pick<CaptionPreset, "scale" | "y" | "maxWords" | "animationIn" | "isNew">> = {},
): CaptionPreset => ({
  id,
  name,
  categories,
  isNew: options.isNew,
  style: { color: "#FFFFFF", background: null, align: "center", ...style, fontFamily: stack(style.fontFamily) },
  scale: options.scale ?? 1,
  y: options.y ?? 28,
  maxWords: options.maxWords ?? 3,
  animationIn: options.animationIn ?? NONE,
});

export const CAPTION_PRESETS: readonly CaptionPreset[] = [
  preset("bold-caps", "Bold", ["business", "story"], { fontFamily: "Montserrat", fontWeight: 900, uppercase: true, outline: black(8) }),
  preset("yellow-pop", "Yellow pop", ["business", "story", "education"], { fontFamily: "Montserrat", fontWeight: 900, uppercase: true, outline: black(10), activeWord: { color: "#FFD400", scale: 1.1 } }, { maxWords: 2, animationIn: POP }),
  preset("green-word", "Green word", ["gaming", "business"], { fontFamily: "Montserrat", fontWeight: 900, uppercase: true, outline: black(8), activeWord: { color: "#22E06B" } }),
  preset("red-box", "Red box", ["business", "story"], { fontFamily: "Poppins", fontWeight: 800, outline: black(6), activeWord: { background: "#E11D48" } }, { maxWords: 3 }),
  preset("white-pill", "Pill", ["education", "podcast"], { fontFamily: "Poppins", fontWeight: 800, color: "#111111", background: "#FFFFFF", radius: 400 }, { scale: 0.85, maxWords: 4 }),
  preset("karaoke", "Karaoke", ["music", "kids"], { fontFamily: "Poppins", fontWeight: 800, outline: black(6), upcomingOpacity: 0.35 }, { maxWords: 5, scale: 0.9 }),
  preset("word-reveal", "Word by word", ["story", "education"], { fontFamily: "Lexend", fontWeight: 700, shadow: "0 4px 14px rgba(0,0,0,0.6)", upcomingOpacity: 0 }, { maxWords: 6, scale: 0.85, isNew: true }),
  preset("elegant", "Elegant", ["story", "podcast"], { fontFamily: "Playfair Display", fontWeight: 700, shadow: "0 3px 12px rgba(0,0,0,0.7)" }, { maxWords: 4, animationIn: FADE }),
  preset("elegant-gold", "Elegant gold", ["story", "music"], { fontFamily: "Playfair Display", fontWeight: 700, italic: true, shadow: "0 3px 12px rgba(0,0,0,0.7)", activeWord: { color: "#F5C26B" } }, { maxWords: 4, isNew: true }),
  preset("tall-caps", "Tall caps", ["gaming", "business"], { fontFamily: "Bebas Neue", fontWeight: 400, uppercase: true, letterSpacing: 2, outline: black(6), activeWord: { color: "#FFD400" } }, { scale: 1.3, maxWords: 3 }),
  preset("impact", "Impact", ["gaming"], { fontFamily: "Anton", fontWeight: 400, uppercase: true, outline: black(10), activeWord: { color: "#FF3B30" } }, { scale: 1.1, maxWords: 2, animationIn: POP }),
  preset("comic", "Comic", ["kids", "gaming"], { fontFamily: "Bangers", fontWeight: 400, color: "#FFE600", letterSpacing: 1, outline: black(8) }, { scale: 1.2, animationIn: POP }),
  preset("marker", "Marker", ["kids", "story"], { fontFamily: "Permanent Marker", fontWeight: 400, shadow: "0 4px 0 rgba(0,0,0,0.8)" }, { maxWords: 4, isNew: true }),
  preset("neon", "Neon", ["gaming", "music"], { fontFamily: "Montserrat", fontWeight: 900, uppercase: true, shadow: "0 0 18px #3BF4FB, 0 0 36px #3BF4FB", activeWord: { color: "#3BF4FB" } }, { isNew: true }),
  preset("sing-along", "Sing-along", ["music", "kids"], { fontFamily: "Lexend", fontWeight: 700, outline: black(6), upcomingOpacity: 0.35, activeWord: { color: "#FFD400", scale: 1.08 } }, { maxWords: 6, scale: 0.85, isNew: true }),
  preset("lower-third", "Lower third", ["podcast", "education"], { fontFamily: "Lexend", fontWeight: 600, background: "rgba(0,0,0,0.6)", radius: 16 }, { scale: 0.7, y: 36, maxWords: 7 }),
  preset("headline", "Headline", ["business"], { fontFamily: "Montserrat", fontWeight: 900, uppercase: true, color: "#111111", background: "#FFD400", radius: 12 }, { maxWords: 2, animationIn: POP }),
  preset("soft-card", "Soft card", ["education", "kids"], { fontFamily: "Poppins", fontWeight: 700, color: "#1E293B", background: "#C7D2FE", radius: 18 }, { scale: 0.8, maxWords: 4 }),
  preset("one-word", "One word", ["business", "gaming"], { fontFamily: "Montserrat", fontWeight: 900, uppercase: true, outline: black(12) }, { scale: 1.35, maxWords: 1, animationIn: POP, isNew: true }),
  preset("subtle", "Subtle", ["podcast", "education", "story"], { fontFamily: "Poppins", fontWeight: 700, shadow: "0 2px 8px rgba(0,0,0,0.8)" }, { scale: 0.75, maxWords: 6 }),
];

export const captionPresetById = (id: string | null | undefined) => CAPTION_PRESETS.find((item) => item.id === id) ?? null;

/** The text style a preset gives a caption in this frame. */
export const presetStyle = (item: CaptionPreset, format: VideoFormat): TextStyle => ({
  ...item.style,
  fontSize: Math.round(CAPTION_BASE_SIZE[format] * item.scale),
});

const LINE_END = /[.!?,;:—–]["')\]]*$/;
/** A line stays up through a pause this long, then gives way to the next. */
const HOLD_FRAMES = 12;

/**
 * Caption words in timeline time. Null unless every caption knows when its words are said,
 * since re-cutting lines from evenly spread words would only move the guesses around.
 */
const timedWords = (captions: readonly TextItem[]) => {
  if (captions.some((item) => !item.words?.length)) return null;
  return captions
    .flatMap((item) => captionWords(item).map((word) => ({ text: word.text, from: item.from + word.from, to: item.from + word.to })))
    .sort((a, b) => a.from - b.from);
};

/** Words cut into lines of at most `maxWords`, closing early at punctuation. Each line keeps its own word times. */
export const captionLinesFromWords = (words: readonly CaptionWord[], maxWords: number) => {
  const lines: CaptionWord[][] = [];
  let line: CaptionWord[] = [];
  for (const word of words) {
    line.push(word);
    if (line.length >= maxWords || LINE_END.test(word.text)) {
      lines.push(line);
      line = [];
    }
  }
  if (line.length) lines.push(line);
  return lines.map((group, index) => {
    const next = lines[index + 1];
    const from = group[0].from;
    const lastTo = group.at(-1)!.to;
    // A line runs into the next one, unless a long pause comes first.
    const to = next ? Math.min(next[0].from, lastTo + HOLD_FRAMES) : lastTo + HOLD_FRAMES;
    return {
      text: group.map((word) => word.text).join(" "),
      from,
      durationInFrames: Math.max(1, to - from),
      words: group.map((word) => ({ text: word.text, from: word.from - from, to: Math.max(word.from - from, word.to - from) })),
    };
  });
};

/**
 * Gives every caption a preset's look. When the captions know when each word is said, they are
 * also re-cut into lines of the preset's length, on the track where the first caption sits.
 * Other titles are left alone.
 */
export const applyCaptionPreset = (timeline: Timeline, presetId: string): Timeline => {
  const look = captionPresetById(presetId);
  if (!look) throw new Error("That caption style doesn't exist.");
  const style = presetStyle(look, timeline.format);
  const captions = timeline.tracks.flatMap((track) => track.items.filter(isCaption));
  if (captions.length === 0) throw new Error("There are no captions on this timeline yet.");
  const restyle = (item: TextItem): TextItem => ({
    ...item,
    role: "caption",
    style,
    transform: { ...item.transform, y: look.y },
    animationIn: look.animationIn,
    animationOut: NONE,
  });
  const words = timedWords(captions);
  if (!words) {
    return {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({ ...track, items: track.items.map((item) => (isCaption(item) ? restyle(item) : item)) })),
    };
  }
  const home = timeline.tracks.find((track) => track.items.some(isCaption))!;
  const template = captions[0];
  const highlight = captions.find((item) => item.highlight)?.highlight;
  const recut: TextItem[] = captionLinesFromWords(words, look.maxWords).map((line) =>
    restyle({
      ...template,
      id: newId(),
      text: line.text,
      from: line.from,
      durationInFrames: line.durationInFrames,
      words: line.words,
      transitionIn: null,
      transitionOut: null,
      transform: { ...defaultTransform(), ...template.transform },
      // A highlighted word follows its line when the lines are re-cut.
      highlight: highlight && line.text.toLowerCase().includes(highlight.text.toLowerCase()) ? highlight : undefined,
      layout: undefined,
    }),
  );
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      const kept = track.items.filter((item) => !isCaption(item));
      return track.id === home.id ? { ...track, items: [...kept, ...recut].sort((a, b) => a.from - b.from) } : { ...track, items: kept };
    }),
  };
};

/** Changes one part of every caption's look, keeping the rest, for the Custom controls. */
export const styleAllCaptions = (timeline: Timeline, patch: Partial<TextStyle>, y?: number): Timeline => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => ({
    ...track,
    items: track.items.map((item) =>
      isCaption(item)
        ? { ...item, role: "caption", style: { ...item.style, ...patch }, ...(y === undefined ? {} : { transform: { ...item.transform, y } }) }
        : item,
    ),
  })),
});

/** The look the captions share now: the first caption's, or null when there are none. */
export const currentCaptionStyle = (timeline: Timeline) => {
  const first = timeline.tracks.flatMap((track) => track.items.filter(isCaption))[0];
  return first ? { style: first.style, y: first.transform.y } : null;
};

/**
 * Captions laid over timed speech in a preset's look, on their own text track. Words are in
 * seconds of the timeline. Captions already on the timeline are replaced.
 */
export const addTimedCaptions = (
  timeline: Timeline,
  words: readonly { text: string; start: number; end: number }[],
  presetId: string,
  fps: number,
): Timeline => {
  const look = captionPresetById(presetId) ?? CAPTION_PRESETS[0];
  const framed = words
    .filter((word) => word.text.trim())
    .map((word) => {
      const from = Math.max(0, Math.round(word.start * fps));
      return { text: word.text.trim(), from, to: Math.max(from, Math.round(word.end * fps)) };
    });
  if (framed.length === 0) throw new Error("There is no speech to caption.");
  const style = presetStyle(look, timeline.format);
  const items: TextItem[] = captionLinesFromWords(framed, look.maxWords).map((line) => ({
    id: newId(),
    kind: "text",
    role: "caption",
    text: line.text,
    from: line.from,
    durationInFrames: line.durationInFrames,
    transitionIn: null,
    transitionOut: null,
    style,
    transform: { ...defaultTransform(), y: look.y },
    animationIn: look.animationIn,
    animationOut: NONE,
    words: line.words,
  }));
  const withoutCaptions = timeline.tracks.map((track) => ({ ...track, items: track.items.filter((item) => !isCaption(item)) }));
  return {
    ...timeline,
    tracks: [
      ...withoutCaptions,
      { id: newId(), kind: "text", name: "Captions", muted: false, hidden: false, locked: false, items },
    ],
  };
};
