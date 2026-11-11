import { generationModelById, generationModelBySlug, type GenerationModelId } from "@/lib/video/models";

/** One line on an approved brief naming the footage model they picked. */
export const MODEL_NOTE_PREFIX = "Generation model:";

export const modelNote = (modelId: GenerationModelId) => `${MODEL_NOTE_PREFIX} ${modelId}`;

const modelIdFromToken = (token: string): GenerationModelId | "" =>
  generationModelById(token)?.id ?? generationModelBySlug(token)?.id ?? "";

export const modelFromNote = (text: string): GenerationModelId | "" => {
  let model: GenerationModelId | "" = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith(MODEL_NOTE_PREFIX)) continue;
    const token = line.slice(MODEL_NOTE_PREFIX.length).trim().split(/\s+/)[0] ?? "";
    const next = modelIdFromToken(token);
    if (next) model = next;
  }
  return model;
};

export const proseWithoutModelNote = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith(MODEL_NOTE_PREFIX))
    .join("\n")
    .trim();

/** The footage model named on this message. Empty when the message does not pick one. */
export const modelFromMessage = (message: { parts: readonly { type: string; text?: string }[] }) => {
  let model: GenerationModelId | "" = "";
  for (const part of message.parts) {
    if (part.type !== "text" || !part.text) continue;
    const next = modelFromNote(part.text);
    if (next) model = next;
  }
  return model;
};

/**
 * The model a queued video should film with.
 * A note on the approval wins over a model the Coach typed into the tool call.
 */
export const modelIdForQueue = (noted: string | undefined, requested: unknown): GenerationModelId | undefined => {
  const fromNote = modelIdFromToken((noted ?? "").trim());
  if (fromNote) return fromNote;
  if (typeof requested !== "string") return undefined;
  return modelIdFromToken(requested.trim()) || undefined;
};
