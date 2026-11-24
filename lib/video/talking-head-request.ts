/**
 * What a talking-head model (HeyGen Avatar 6 on OpenRouter) is sent, and the words that direct it.
 * Nothing here touches the network, so the request shape can be tested.
 */

import type { VideoFormat } from "./schema";

/** HeyGen reads at most this much of the motion direction. */
export const MOTION_PROMPT_LIMIT = 1200;

/**
 * OpenRouter rejects fields a model does not list, so the talking-head body carries only these:
 * no duration (the speech sets the length), no aspect ratio (the picture sets the shape),
 * no first frame, and no audio switch. The picture and the voice both go in input_references.
 */
export const talkingHeadBody = (input: {
  model: string;
  prompt: string;
  resolution?: string;
  imageUrl: string;
  audioUrl: string;
}) => ({
  model: input.model,
  prompt: input.prompt.trim().slice(0, MOTION_PROMPT_LIMIT),
  ...(input.resolution ? { resolution: input.resolution } : {}),
  input_references: [
    { type: "image_url", image_url: { url: input.imageUrl } },
    { type: "audio_url", audio_url: { url: input.audioUrl } },
  ],
});

/**
 * What a talking head is told about how it moves. Only what the person wrote: no added props,
 * gestures, or style. Avatar 6 needs some prompt, so with nothing written it is only told to speak.
 */
export const talkingHeadMotion = (visualDirection?: string) =>
  (visualDirection?.trim() || "The person speaks to the camera.").slice(0, MOTION_PROMPT_LIMIT);

/**
 * The still a UGC ad starts from. It keeps the character's face, includes the product photo when
 * one was given, and otherwise follows only what the person wrote. Nothing else is added.
 */
export const ugcStillPrompt = (input: { hasProduct: boolean; direction?: string }) =>
  [
    "The person is the one in the subject reference pictures. Keep the same face, hair, skin, and build.",
    input.hasProduct ? "Include the product from the last reference picture, keeping its exact shape, colors, and label." : "",
    input.direction?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(" ");

/** Width and height of a centered crop with this aspect, kept a little above center so the face stays in. */
export const cropForFormat = (width: number, height: number, format: VideoFormat) => {
  const [w, h] = format.split(":").map(Number);
  const target = w / h;
  const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
  if (width / height > target) {
    const cropWidth = even(height * target);
    return { width: cropWidth, height: even(height), x: Math.floor((width - cropWidth) / 2), y: 0 };
  }
  const cropHeight = even(width / target);
  // Faces sit in the upper part of most portraits, so a third of the spare height goes above.
  return { width: even(width), height: cropHeight, x: 0, y: Math.floor((height - cropHeight) / 3) };
};
