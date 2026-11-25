/**
 * Layout styles: ready-made ways of editing a short from one avatar take (or, for a sketch,
 * one voice track). Each beat of the script gets a layout: how the take, a picture, and the
 * captions are arranged while those words are spoken.
 */

export const LAYOUT_STYLE_IDS = [
  "split-presenter",
  "punch-in",
  "source-reader",
  "framed-post",
  "screen-demo",
  "sketch-explainer",
] as const;
export type LayoutStyleId = (typeof LAYOUT_STYLE_IDS)[number];

export const LAYOUT_NAMES = ["split", "avatar", "avatar-close", "picture", "card", "bubble", "framed", "window", "sketch", "endcard"] as const;
export type LayoutName = (typeof LAYOUT_NAMES)[number];

/** What an upload the person gave is, so the planner and the rules know where it can go. */
export const LAYOUT_MEDIA_ROLES = ["post", "screenshot", "recording", "picture"] as const;
export type LayoutMediaRole = (typeof LAYOUT_MEDIA_ROLES)[number];

export interface LayoutMedia {
  key: string;
  kind: "image" | "video";
  role: LayoutMediaRole;
  /** What it shows, in the person's words. Optional. */
  note?: string;
}

export interface LayoutStyle {
  id: LayoutStyleId;
  title: string;
  description: string;
  /** False for a style with no person on camera. */
  avatar: boolean;
  /** Seconds a beat aims for, and the most it may run. */
  beatSeconds: { target: number; max: number };
  /** Words per caption line. */
  captionWords: number;
  /** Layouts this style may use. The first is the default. */
  layouts: readonly LayoutName[];
  /** Uploads this style needs before it can run. Any one of them is enough. */
  needs?: readonly LayoutMediaRole[];
  /** Share of beats that show a drawn picture, used to price the style before it is planned. */
  pictureShare: number;
}

export const LAYOUT_STYLES: readonly LayoutStyle[] = [
  {
    id: "split-presenter",
    title: "Split presenter",
    description: "A picture on top and you below, cutting to a close-up on the hook, the punch lines, and the call to action.",
    avatar: true,
    beatSeconds: { target: 2.5, max: 3.5 },
    captionWords: 3,
    layouts: ["split", "avatar-close", "card"],
    pictureShare: 0.8,
  },
  {
    id: "punch-in",
    title: "Punch-in",
    description: "You on camera the whole way, punching in close at each new sentence, with quick picture cutaways.",
    avatar: true,
    beatSeconds: { target: 3, max: 5 },
    captionWords: 2,
    layouts: ["avatar", "avatar-close", "picture"],
    pictureShare: 0.25,
  },
  {
    id: "source-reader",
    title: "Source reader",
    description: "React to a post or article: the screenshot fills the frame with you in a bubble, then you on camera.",
    avatar: true,
    beatSeconds: { target: 3.5, max: 6 },
    captionWords: 3,
    layouts: ["bubble", "avatar"],
    needs: ["post"],
    pictureShare: 0,
  },
  {
    id: "framed-post",
    title: "Framed post",
    description: "Your name and a headline on top, you in a band in the middle, captions under it, ending on a call to action.",
    avatar: true,
    beatSeconds: { target: 4, max: 7 },
    captionWords: 4,
    layouts: ["framed", "endcard"],
    pictureShare: 0,
  },
  {
    id: "screen-demo",
    title: "Screen demo",
    description: "Opens on you for the hook, then your screen in a rounded window with you in a bubble.",
    avatar: true,
    beatSeconds: { target: 3, max: 6 },
    captionWords: 1,
    layouts: ["window", "avatar-close"],
    needs: ["recording", "screenshot"],
    pictureShare: 0,
  },
  {
    id: "sketch-explainer",
    title: "Sketch explainer",
    description: "No one on camera: a two-word headline and a simple drawn chart or diagram for each beat, on paper.",
    avatar: false,
    beatSeconds: { target: 4, max: 7 },
    captionWords: 4,
    layouts: ["sketch"],
    pictureShare: 0,
  },
];

export const isLayoutStyleId = (value: unknown): value is LayoutStyleId =>
  typeof value === "string" && (LAYOUT_STYLE_IDS as readonly string[]).includes(value);

export const layoutStyleById = (id: string | null | undefined) => LAYOUT_STYLES.find((style) => style.id === id) ?? null;

/** Model stamp on a layout-style job, shown as its own label in the library. */
export const LAYOUT_MODEL = "layout-style";
export const LAYOUT_LABEL = "Layout style";

/** Job mode of a layout-style video. It is not a Create mode: it is applied to a finished video. */
export const LAYOUT_JOB_MODE = "layout-style";

/** What a layout-style job is told to do: which style, applied to which finished video, with which uploads. */
export interface LayoutJobSettings {
  style: LayoutStyleId;
  sourceVideoId: string;
  media: LayoutMedia[];
  /** A caption preset's id. Unset keeps the style's own caption look. */
  captionPreset?: string;
}

/** The shape of a caption preset id. Whether it names a real preset is checked where it is used. */
export const CAPTION_PRESET_ID = /^[a-z0-9-]{1,40}$/;

const MEDIA_KEY = /^uploads\/[^/]+\/.+/;

/** The settings stored on a job, or null when the job has none or they are broken. */
export const readLayoutSettings = (value: unknown): LayoutJobSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!isLayoutStyleId(record.style) || typeof record.sourceVideoId !== "string" || !record.sourceVideoId) return null;
  const media = Array.isArray(record.media)
    ? record.media.flatMap((item): LayoutMedia[] => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        if (typeof row.key !== "string" || !MEDIA_KEY.test(row.key)) return [];
        if (row.kind !== "image" && row.kind !== "video") return [];
        if (!(LAYOUT_MEDIA_ROLES as readonly string[]).includes(String(row.role))) return [];
        return [
          {
            key: row.key,
            kind: row.kind,
            role: row.role as LayoutMediaRole,
            ...(typeof row.note === "string" && row.note.trim() ? { note: row.note.trim().slice(0, 300) } : {}),
          },
        ];
      })
    : [];
  return {
    style: record.style,
    sourceVideoId: record.sourceVideoId,
    media: media.slice(0, 12),
    ...(typeof record.captionPreset === "string" && CAPTION_PRESET_ID.test(record.captionPreset) ? { captionPreset: record.captionPreset } : {}),
  };
};

/** Why a style can't run with these uploads, or null when it can. A style that needs a post refuses to run without one. */
export const styleNeedsProblem = (style: LayoutStyle, media: readonly { role: LayoutMediaRole }[]) => {
  if (!style.needs || media.some((item) => style.needs!.includes(item.role))) return null;
  const needs = new Intl.ListFormat("en", { type: "disjunction" }).format(style.needs.map((role) => `a ${role}`));
  return `${style.title} needs ${needs}. Upload one first.`;
};

/** Pictures a style will likely draw for a take this long, before any upload is counted. */
export const estimatedPictures = (style: LayoutStyle, seconds: number) =>
  Math.ceil((Math.max(0, seconds) / style.beatSeconds.target) * style.pictureShare);
