import { briefFromParts } from "@/lib/coach/brief-blocks";
import { isImageKey, uploadFileUrl } from "@/lib/storage/upload-key";
import { toolResultView } from "@/lib/tools/result";

export type CoachPictureRef = {
  key: string;
  url: string;
};

type PicturePart = {
  type: string;
  text?: string;
  state?: string;
  output?: unknown;
};

const addPicture = (pictures: CoachPictureRef[], key: unknown, url?: unknown) => {
  if (typeof key !== "string" || !isImageKey(key)) return;
  if (pictures.some((picture) => picture.key === key)) return;
  const href = typeof url === "string" && url.startsWith("/") ? url : uploadFileUrl(key);
  pictures.push({ key, url: href });
};

const framesOf = (output: unknown) => {
  if (!output || typeof output !== "object") return [];
  const frames = (output as { frames?: unknown }).frames;
  return Array.isArray(frames) ? frames : [];
};

/** Pictures this message already produced: storyboard frames, generated stills, and brief frame keys. */
export const picturesFromMessage = (message: { parts?: readonly PicturePart[] | null }): CoachPictureRef[] => {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const pictures: CoachPictureRef[] = [];
  const brief = briefFromParts(parts);
  for (const key of brief?.frames ?? []) addPicture(pictures, key);
  for (const part of parts) {
    if (part.state !== "output-available") continue;
    if (part.type === "tool-make_storyboard") {
      for (const frame of framesOf(part.output)) {
        if (!frame || typeof frame !== "object") continue;
        const row = frame as { imageKey?: unknown; url?: unknown };
        addPicture(pictures, row.imageKey, row.url);
      }
    }
    const view = toolResultView(part.output);
    if (view.imageKey) addPicture(pictures, view.imageKey, view.imageUrl);
  }
  return pictures;
};

/** Every picture in the thread, so a later reply can show a frame it cites. */
export const picturesFromMessages = (messages: readonly { parts?: readonly PicturePart[] | null }[]): CoachPictureRef[] => {
  const pictures: CoachPictureRef[] = [];
  for (const message of messages) {
    for (const picture of picturesFromMessage(message)) addPicture(pictures, picture.key, picture.url);
  }
  return pictures;
};

const fileName = (key: string) => key.slice(key.lastIndexOf("/") + 1);

const stemOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
};

/** The id written in the chat, without a trailing ellipsis or a closing punctuation mark. */
const citation = (token: string) => {
  let value = token.trim();
  while (value.startsWith("(") || value.startsWith("\"") || value.startsWith("'") || value.startsWith("`")) {
    value = value.slice(1);
  }
  while (value.endsWith("`") || value.endsWith("\"") || value.endsWith("'")) value = value.slice(0, -1);
  while (value.endsWith("...")) value = value.slice(0, -3);
  while (value.endsWith("…")) value = value.slice(0, -1);
  while (value.length > 0) {
    const last = value.at(-1) ?? "";
    if (last !== "," && last !== ";" && last !== ":" && last !== ")" && last !== "]" && last !== ".") break;
    if (value.endsWith(".jpg") || value.endsWith(".png") || value.endsWith(".webp")) break;
    value = value.slice(0, -1);
  }
  return value;
};

/**
 * The picture a chat token refers to, when it is one of the pictures we already have.
 * A shortened id matches only when one picture starts with it.
 */
export const pictureForMention = (token: string, pictures: readonly CoachPictureRef[]): CoachPictureRef | null => {
  const raw = citation(token);
  if (raw.length < 8) return null;
  const exact = pictures.find((picture) => {
    const name = fileName(picture.key);
    return picture.key === raw || name === raw || stemOf(name) === raw;
  });
  if (exact) return exact;
  const matches = pictures.filter((picture) => {
    const name = fileName(picture.key);
    return stemOf(name).startsWith(raw) || name.startsWith(raw);
  });
  return matches.length === 1 ? (matches[0] ?? null) : null;
};
