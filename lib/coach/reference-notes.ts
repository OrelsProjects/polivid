import { isAudioKey, isImageKey, isVideoKey } from "@/lib/storage/upload-key";
import type { AttachedMedia } from "@/lib/tools/types";
import { MAX_REFERENCE_IMAGES } from "@/lib/video/schema";

export const REFERENCE_NOTE_PREFIX = "Attached reference pictures:";
export const ATTACHED_FILE_PREFIX = "Attached file:";

const isReferenceKey = (key: string) =>
  key.startsWith("uploads/") && key.length <= 200 && !/\s/.test(key) && isImageKey(key);

export const referencePictureNote = (keys: readonly string[]) =>
  `${REFERENCE_NOTE_PREFIX} ${mergeReferenceKeys(keys).join(" ")}`;

export const referenceKeysFromNote = (text: string) =>
  mergeReferenceKeys(
    text
      .split("\n")
      .filter((line) => line.trim().startsWith(REFERENCE_NOTE_PREFIX))
      .flatMap((line) => line.trim().slice(REFERENCE_NOTE_PREFIX.length).trim().split(/\s+/)),
  );

export const proseWithoutReferenceNote = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith(REFERENCE_NOTE_PREFIX))
    .join("\n")
    .trim();

export const referenceKeysFromMessages = (
  messages: readonly { role: string; parts: readonly { type: string; text?: string }[] }[],
) =>
  mergeReferenceKeys(
    messages
      .filter((message) => message.role === "user")
      .flatMap((message) =>
        message.parts
          .filter((part) => part.type === "text" && part.text)
          .flatMap((part) => referenceKeysFromNote(part.text ?? "")),
      ),
  );

export const mergeReferenceKeys = (...groups: (readonly string[] | undefined)[]) =>
  [...new Set(groups.flatMap((group) => group ?? []).filter(isReferenceKey))].slice(0, MAX_REFERENCE_IMAGES);

const isAttachedFileKey = (key: string) =>
  key.startsWith("uploads/") && key.length <= 200 && !/\s/.test(key) && (isAudioKey(key) || isVideoKey(key));

const fileKind = (key: string): "audio" | "video" | null =>
  isAudioKey(key) ? "audio" : isVideoKey(key) ? "video" : null;

/** One line naming an audio or video upload. Pictures stay on the reference-picture note. */
export const attachedFileNote = (key: string) => `${ATTACHED_FILE_PREFIX} ${key}`;

export const attachedFilesFromNote = (text: string) => {
  const files: { key: string; kind: "audio" | "video" }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith(ATTACHED_FILE_PREFIX)) continue;
    const key = line.slice(ATTACHED_FILE_PREFIX.length).trim().split(/\s+/)[0] ?? "";
    const kind = fileKind(key);
    if (isAttachedFileKey(key) && kind) files.push({ key, kind });
  }
  return files;
};

export const attachedFileFromNote = (text: string) => attachedFilesFromNote(text)[0] ?? null;

export const proseWithoutAttachedFileNote = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith(ATTACHED_FILE_PREFIX))
    .join("\n")
    .trim();

/** Pictures from reference notes, plus the latest attached audio and the latest attached video. */
export const attachedMediaFromMessages = (
  messages: readonly { role: string; parts: readonly { type: string; text?: string }[] }[],
): AttachedMedia[] => {
  const images = referenceKeysFromMessages(messages).map((key) => ({ key, kind: "image" as const }));
  let audio: AttachedMedia | null = null;
  let video: AttachedMedia | null = null;
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type !== "text" || !part.text) continue;
      for (const next of attachedFilesFromNote(part.text)) {
        if (next.kind === "audio") audio = next;
        if (next.kind === "video") video = next;
      }
    }
  }
  return [...images, ...(audio ? [audio] : []), ...(video ? [video] : [])];
};
