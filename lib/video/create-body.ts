import { modeCanNarrate } from "@/lib/voice/constants";
import { DEFAULT_BACKGROUND_ID } from "./backgrounds";
import type { CreateVideoSchema } from "./create-schema";
import { editValueFor, type EditOp } from "./edit-ops";
import type { GenerationModelId } from "./models";
import {
  modeAcceptsReferenceImages,
  modeAllowsMedia,
  modeNeedsUpload,
  videoModeById,
  type VideoModeId,
  type VideoTier,
} from "./modes";
import type { VideoFormat } from "./schema";
import type { AttachmentAssignment, PromptBrief } from "./shot-plan";
import type { VisualMedia } from "./stills";
import type { z } from "zod";

export type CreateVideoBody = z.input<typeof CreateVideoSchema>;

export interface CreateFormValues {
  prompt: string;
  format: VideoFormat;
  length: number;
  tier: VideoTier;
  model: GenerationModelId;
  mediaKey: string | null;
  referenceKeys: readonly string[];
  showText: boolean;
  presetId: string;
  visualDirection: string;
  characterId: string;
  direction: string;
  scene: string;
  directionKeys: readonly string[];
  sceneKeys: readonly string[];
  media?: VisualMedia;
  verbatim?: boolean;
  /** The page the script text was read from. */
  sourceUrl?: string;
  backgroundId?: string;
  backgroundKey?: string | null;
  /** The quick edit to make, and its setting. */
  op?: EditOp;
  opValue?: string;
}

export interface ApprovedPlan {
  cuts: readonly { seconds: number; camera: string; images?: readonly number[] }[];
  brief?: PromptBrief;
  attachmentRoles?: readonly AttachmentAssignment[];
}

/**
 * The request the create form sends. Fields a mode does not use are left out, so the
 * server never has to guess whether an empty value was meant.
 */
export const buildCreateBody = (input: {
  /** Unset on the plain create page, which films straight with the chosen model. */
  mode?: VideoModeId | null;
  /** Catalog slug the form was opened with. Left out when it is just the mode. */
  tool?: string | null;
  values: CreateFormValues;
  /** False when the tier films with a chat model, as motion graphics does. */
  usesVideoModel: boolean;
  songId?: string | null;
  plan?: ApprovedPlan | null;
}): CreateVideoBody => {
  const { values, plan } = input;
  const mode = input.mode ? videoModeById(input.mode) : null;
  const prompt = values.prompt.trim();
  const acceptsReferences = !mode || modeAcceptsReferenceImages(mode);
  const references =
    acceptsReferences && values.referenceKeys.length > 0 ? { referenceKeys: [...values.referenceKeys] } : {};

  if (!mode) {
    return {
      prompt,
      format: values.format,
      length: values.length,
      model: values.model,
      ...references,
      showText: values.showText,
      presetId: values.presetId,
      visualDirection: values.visualDirection,
      characterId: values.characterId,
    };
  }

  if (mode.id === "edit") {
    const op = values.op ?? "rotate";
    return {
      prompt: "",
      format: values.format,
      // The server reads the real length from the upload. This only satisfies the shared field.
      length: Math.max(2, Math.min(values.length, 180)),
      mode: mode.id,
      ...(input.tool && input.tool !== mode.id ? { tool: input.tool } : {}),
      tier: values.tier,
      ...(values.mediaKey ? { mediaKey: values.mediaKey } : {}),
      op,
      opValue: editValueFor(op, values.opValue),
    };
  }

  const lyrics = mode.id === "lyrics";
  const media: VisualMedia = values.media && modeAllowsMedia(mode, values.media) ? values.media : "video";
  const needsUpload = modeNeedsUpload(mode);
  return {
    prompt,
    format: values.format,
    length: values.length,
    mode: mode.id,
    ...(input.tool && input.tool !== mode.id ? { tool: input.tool } : {}),
    tier: values.tier,
    ...(media !== "video" ? { media } : {}),
    ...(media === "loop"
      ? values.backgroundKey
        ? { backgroundKey: values.backgroundKey }
        : { backgroundId: values.backgroundId ?? DEFAULT_BACKGROUND_ID }
      : {}),
    ...(mode.spokenScript && values.verbatim ? { verbatim: true } : {}),
    ...(mode.spokenScript && values.sourceUrl ? { sourceUrl: values.sourceUrl } : {}),
    ...(input.usesVideoModel && media === "video" ? { model: values.model } : {}),
    ...(needsUpload && values.mediaKey ? { mediaKey: values.mediaKey, imageKey: values.mediaKey } : {}),
    ...references,
    showText: values.showText,
    presetId: values.presetId,
    visualDirection: values.visualDirection,
    ...(lyrics
      ? {
          direction: values.direction,
          scene: values.scene,
          ...(values.directionKeys.length > 0 ? { directionKeys: [...values.directionKeys] } : {}),
          ...(values.sceneKeys.length > 0 ? { sceneKeys: [...values.sceneKeys] } : {}),
        }
      : {}),
    ...(modeCanNarrate(mode.id) ? { characterId: values.characterId } : {}),
    ...(input.songId ? { songId: input.songId } : {}),
    ...(plan
      ? {
          cuts: plan.cuts.map(({ seconds, camera, images }) => ({
            seconds,
            camera,
            ...(images && images.length > 0 ? { images: [...images] } : {}),
          })),
        }
      : {}),
    ...(mode.id === "prompt" && plan?.brief ? { brief: plan.brief } : {}),
    ...(mode.id === "prompt" && plan?.attachmentRoles ? { attachmentRoles: [...plan.attachmentRoles] } : {}),
  };
};
