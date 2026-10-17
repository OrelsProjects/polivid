import { isPictureTool, type PictureTool } from "@/lib/coach/picture-preview";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type SavedPicture = {
  imageKey: string;
  url: string;
  prompt: string;
};

/** A finished still the chat can show. Errors and other tool results are not pictures. */
export const savedPicture = (output: unknown): SavedPicture | null => {
  if (!isRecord(output)) return null;
  if (typeof output.error === "string" && output.error) return null;
  if (typeof output.imageKey !== "string" || !output.imageKey) return null;
  if (typeof output.url !== "string" || !output.url.startsWith("/api/uploads/")) return null;
  return {
    imageKey: output.imageKey,
    url: output.url,
    prompt: typeof output.prompt === "string" ? output.prompt : "",
  };
};

export type StoredPictureCall = {
  tool: PictureTool;
  input: Record<string, unknown>;
};

/** The saved picture call inside one coach message, when it already finished. */
export const storedPictureCall = (parts: unknown, toolCallId: string): StoredPictureCall | null => {
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (!isRecord(part) || part.toolCallId !== toolCallId) continue;
    if (typeof part.type !== "string" || !part.type.startsWith("tool-")) continue;
    const tool = part.type.slice("tool-".length);
    if (!isPictureTool(tool) || part.state !== "output-available") continue;
    return { tool, input: isRecord(part.input) ? part.input : {} };
  }
  return null;
};

/** Swaps one finished picture's output. Returns null when that call is not in the message. */
export const replacePictureOutput = (parts: unknown, toolCallId: string, output: SavedPicture): unknown[] | null => {
  if (!storedPictureCall(parts, toolCallId) || !Array.isArray(parts)) return null;
  return parts.map((part) => {
    if (!isRecord(part) || part.toolCallId !== toolCallId) return part;
    return { ...part, state: "output-available", output };
  });
};
