import { isImageKey } from "@/lib/storage/upload-key";
import { MAX_REFERENCE_IMAGES } from "@/lib/video/schema";

export const REFERENCE_NOTE_PREFIX = "Attached reference pictures:";

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
