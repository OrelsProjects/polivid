import { SKIT_LOOK_CHOICES } from "@/lib/video/skit";
import { z } from "zod";
import { captionPresetById } from "@/lib/editor/caption-presets";
import { LAYOUT_MEDIA_ROLES, LAYOUT_STYLE_IDS } from "@/lib/video/layout/styles";
import { MIN_VIDEO_LENGTH, VIDEO_FORMATS } from "@/lib/video/schema";
import { scriptSize } from "@/lib/video/script-markup";
import { STUDIO_VOICE_ID } from "@/lib/voice/constants";
import { PartnerError } from "./errors";

/** The videos a partner can make. Each is one social-video tool; nothing else is reachable. */
export const PARTNER_VIDEO_KINDS = ["ugc", "avatar", "captions", "faceless", "skit"] as const;
export type PartnerVideoKind = (typeof PARTNER_VIDEO_KINDS)[number] | "layout";

const ID = z.string().trim().uuid();
export const MEDIA_KEY = z.string().trim().min(1).max(200);
const KEY = MEDIA_KEY;
const SCRIPT = z.string().trim().min(3).max(3000);
const TIER = z.enum(["low", "pro", "ultra"]).default("pro");
const DIRECTION = z.string().trim().max(600).optional();

/** A caption preset's id, checked against the presets that exist. */
export const CAPTION_STYLE = z
  .string()
  .trim()
  .refine((id) => captionPresetById(id) !== null, "That caption style doesn't exist. List them with GET /videos/options.");

/** Uploads a layout style may show, as `{ key, role }`. */
export const LAYOUT_MEDIA = z
  .array(z.strictObject({ key: MEDIA_KEY, role: z.enum(LAYOUT_MEDIA_ROLES), note: z.string().trim().max(300).optional() }))
  .max(12);

/**
 * What happens to a UGC ad or talking avatar once it is filmed: laid out in a style, given a caption
 * preset's look, or both. It runs by itself, as a new video linked to the first.
 */
export const FinishSchema = z
  .strictObject({
    style: z.enum(LAYOUT_STYLE_IDS).optional(),
    media: LAYOUT_MEDIA.optional(),
    /** A caption preset's id, or false for no captions. */
    captions: z.union([CAPTION_STYLE, z.literal(false)]).optional(),
  })
  .refine((finish) => finish.style !== undefined || typeof finish.captions === "string", {
    message: "Send a style, a caption style, or both.",
  })
  .refine((finish) => finish.style !== undefined || !finish.media?.length, {
    message: "Uploads only go with a style.",
    path: ["media"],
  });
export type PartnerFinish = z.infer<typeof FinishSchema>;

/** Strict shapes: an unknown field is a mistake on the partner's side, so it is refused, not ignored. */
export const PartnerVideoSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("ugc"),
    characterId: ID,
    characterLookId: z.string().trim().min(1).optional(),
    script: SCRIPT,
    productKey: KEY.optional(),
    direction: DIRECTION,
    format: z.enum(VIDEO_FORMATS).default("9:16"),
    tier: TIER,
    captions: z.boolean().optional(),
    finish: FinishSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("avatar"),
    characterId: ID.optional(),
    characterLookId: z.string().trim().min(1).optional(),
    photoKey: KEY.optional(),
    script: SCRIPT,
    direction: DIRECTION,
    format: z.enum(VIDEO_FORMATS).default("9:16"),
    tier: TIER,
    finish: FinishSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("captions"),
    videoKey: KEY,
  }),
  z.strictObject({
    kind: z.literal("skit"),
    /** The character acts the script out, one shot per beat, and reads it in their own voice. */
    characterId: ID,
    characterLookId: z.string().trim().min(1).optional(),
    /** Read word for word. A note in [brackets] says what the character does there, and is not read. */
    script: SCRIPT,
    /**
     * auto (default) draws a photo character in retro-cartoon and keeps a drawn one as it is; own
     * films the character's pictures as they are; the rest draw the character in that look.
     */
    look: z.enum(SKIT_LOOK_CHOICES).default("auto"),
    direction: DIRECTION,
    format: z.enum(VIDEO_FORMATS).default("9:16"),
    tier: TIER,
    finish: FinishSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("faceless"),
    /** Said word for word over drawn, slowly moving pictures. */
    script: SCRIPT,
    characterId: ID.optional(),
    direction: DIRECTION,
    format: z.enum(VIDEO_FORMATS).default("9:16"),
    tier: TIER,
  }),
]);
export type PartnerVideoInput = z.infer<typeof PartnerVideoSchema>;

export const parseVideo = (raw: unknown) => {
  const parsed = PartnerVideoSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new PartnerError("invalid", issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "That video request isn't valid.");
};

/** The same request, in the shape the Create page sends. The mode decides which tool makes it. */
export const createBodyFor = (input: PartnerVideoInput): Record<string, unknown> => {
  if (input.kind === "ugc") {
    return {
      mode: "ugc",
      prompt: input.script,
      format: input.format,
      length: MIN_VIDEO_LENGTH,
      tier: input.tier,
      characterId: input.characterId,
      ...(input.characterLookId ? { characterLookId: input.characterLookId } : {}),
      ...(input.productKey ? { mediaKey: input.productKey } : {}),
      ...(input.direction ? { visualDirection: input.direction } : {}),
      showText: input.captions !== false,
    };
  }
  if (input.kind === "avatar") {
    if (!input.characterId && !input.photoKey) throw new PartnerError("invalid", "Send a characterId or a photoKey.");
    return {
      mode: "avatar",
      prompt: input.script,
      format: input.format,
      length: MIN_VIDEO_LENGTH,
      tier: input.tier,
      ...(input.characterId ? { characterId: input.characterId } : {}),
      ...(input.characterLookId ? { characterLookId: input.characterLookId } : {}),
      ...(input.photoKey ? { mediaKey: input.photoKey } : {}),
      ...(input.direction ? { visualDirection: input.direction } : {}),
    };
  }
  if (input.kind === "skit") {
    return {
      mode: "skit",
      prompt: input.script,
      verbatim: true,
      format: input.format,
      // The shots set the real length when it's queued; this only has to be a valid start.
      length: Math.max(MIN_VIDEO_LENGTH, scriptSize(input.script).seconds),
      tier: input.tier,
      characterId: input.characterId,
      ...(input.characterLookId ? { characterLookId: input.characterLookId } : {}),
      ...(input.direction ? { visualDirection: input.direction } : {}),
      presetId: input.look,
      showText: false,
    };
  }
  if (input.kind === "captions") {
    // The upload sets the shape and length. These only fill the shared fields.
    return { mode: "captions", prompt: "Add captions to this video.", format: "9:16", length: 5, tier: "pro", mediaKey: input.videoKey };
  }
  return {
    mode: "voiceover",
    media: "stills",
    verbatim: true,
    prompt: input.script,
    format: input.format,
    length: Math.max(MIN_VIDEO_LENGTH, scriptSize(input.script).seconds),
    tier: input.tier,
    characterId: input.characterId ?? STUDIO_VOICE_ID,
    ...(input.direction ? { visualDirection: input.direction } : {}),
  };
};

