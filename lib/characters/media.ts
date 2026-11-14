/**
 * A character's pictures, clips, and looks, and how they are turned into what a video model sees.
 * Pure: safe in the browser, the server, and tests.
 */

export const MEDIA_KINDS = ["image", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_LABELS = ["face", "profile", "full_body", "expression", "outfit", "other"] as const;
export type MediaLabel = (typeof MEDIA_LABELS)[number];

export const MEDIA_LABEL_NAMES: Record<MediaLabel, string> = {
  face: "Face close-up",
  profile: "Side profile",
  full_body: "Full body",
  expression: "Expression",
  outfit: "Outfit",
  other: "Other",
};

export const MAX_CHARACTER_IMAGES = 24;
export const MAX_CHARACTER_CLIPS = 6;
export const MAX_CHARACTER_LOOKS = 8;
export const MAX_CLIP_SECONDS = 20;
export const MAX_DESCRIPTION = 1200;
export const MAX_PERSONALITY = 800;
export const MAX_SPEAKING_STYLE = 400;
export const MAX_LOOK_NAME = 40;
export const MAX_WARDROBE = 400;
export const MAX_CAPTION = 200;

/** Pictures of the character a single video may use, so other reference pictures still fit. */
export const MAX_CHARACTER_REFERENCES = 4;

export interface CharacterMediaItem {
  id: string;
  kind: MediaKind;
  key: string;
  url: string;
  label: MediaLabel;
  lookId: string | null;
  caption: string | null;
  durationSec: number | null;
  sourceMediaId: string | null;
  position: number;
}

export interface CharacterLookItem {
  id: string;
  name: string;
  wardrobe: string | null;
  position: number;
}

export const isMediaLabel = (value: unknown): value is MediaLabel =>
  typeof value === "string" && (MEDIA_LABELS as readonly string[]).includes(value);

export const isMediaKind = (value: unknown): value is MediaKind =>
  typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);

/** Identity first: a clear face does the most to keep the person the same, then the rest of the body. */
const LABEL_ORDER: Record<MediaLabel, number> = {
  face: 0,
  profile: 1,
  full_body: 2,
  outfit: 3,
  expression: 4,
  other: 5,
};

const byPreference = (a: CharacterMediaItem, b: CharacterMediaItem) =>
  LABEL_ORDER[a.label] - LABEL_ORDER[b.label] || a.position - b.position;

/**
 * The pictures to send for this character, in order. The main picture always leads.
 * With a look, that look's pictures come next (its outfit is what should be worn), then pictures with no look.
 * Pictures from other looks are left out so the model doesn't mix outfits.
 * At most one picture per label is taken before a second of the same label, so the set covers more angles.
 */
export const pickReferenceKeys = (input: {
  mainKey: string | null;
  media: readonly CharacterMediaItem[];
  lookId?: string | null;
  max?: number;
}) => {
  const max = Math.max(0, input.max ?? MAX_CHARACTER_REFERENCES);
  const images = input.media.filter((item) => item.kind === "image");
  const lookId = input.lookId || null;
  const inLook = lookId ? images.filter((item) => item.lookId === lookId).sort(byPreference) : [];
  const neutral = images.filter((item) => item.lookId === null).sort(byPreference);
  const ordered: string[] = [];
  const add = (key: string | null | undefined) => {
    if (key && !ordered.includes(key)) ordered.push(key);
  };
  // Without a look the main picture leads. With one, the look's best picture leads, then the main picture.
  if (!lookId) add(input.mainKey);
  const pool = [...inLook, ...neutral];
  const seen = new Set<MediaLabel>();
  for (const item of pool) {
    if (seen.has(item.label)) continue;
    seen.add(item.label);
    add(item.key);
    if (lookId && ordered.length === 1) add(input.mainKey);
  }
  for (const item of pool) add(item.key);
  if (lookId) add(input.mainKey);
  return ordered.slice(0, max);
};

/** A clip to send to models that take video: the look's first clip, else the first clip with no look. */
export const pickReferenceClip = (media: readonly CharacterMediaItem[], lookId?: string | null) => {
  const clips = media.filter((item) => item.kind === "video").sort((a, b) => a.position - b.position);
  return (lookId ? clips.find((item) => item.lookId === lookId) : undefined) ?? clips.find((item) => item.lookId === null) ?? clips[0] ?? null;
};

const clean = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";

/**
 * The words that keep a character consistent in every shot, even on models that take no pictures.
 * Empty when there is nothing written down.
 */
export const characterNote = (
  character: { name: string; description?: string | null; personality?: string | null; speakingStyle?: string | null },
  look?: { name: string; wardrobe?: string | null } | null,
  options: { voice?: boolean } = {},
) => {
  const parts: string[] = [];
  const description = clean(character.description);
  if (description) parts.push(`${character.name}: ${description}`);
  if (look) {
    const wardrobe = clean(look.wardrobe);
    parts.push(wardrobe ? `${character.name} wears the "${look.name}" look: ${wardrobe}` : `${character.name} wears the "${look.name}" look.`);
  }
  const personality = clean(character.personality);
  if (personality) parts.push(`Personality: ${personality}`);
  if (options.voice) {
    const speaking = clean(character.speakingStyle);
    if (speaking) parts.push(`Speaks: ${speaking}`);
  }
  return parts.length ? `Character — ${parts.join(". ").replace(/\.\./g, ".")}` : "";
};
