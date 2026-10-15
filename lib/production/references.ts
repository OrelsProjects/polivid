import { isImageKey, isOwnedUploadKey, uploadExtension } from "@/lib/storage/upload-key";
import type { Attachment, InputRecord } from "./schema";

/** Image models accept a handful of references; more than this is ignored by most providers. */
export const MAX_STILL_REFERENCES = 4;

const MIME_FOR_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const mimeForUploadKey = (key: string) => MIME_FOR_EXT[uploadExtension(key)] ?? "application/octet-stream";

/** Keeps only picture uploads that belong to this user, in the order they were chosen. */
export const ownedReferenceKeys = (userId: string, keys: string[]) =>
  [...new Set(keys)].filter((key) => isOwnedUploadKey(userId, key) && isImageKey(key));

export const referenceAttachments = (keys: string[]): Attachment[] =>
  keys.map((key, index) => ({
    id: `ref_${index + 1}`,
    name: `Reference picture ${index + 1}`,
    mime: mimeForUploadKey(key),
    kind: "image",
    text: null,
    key,
  }));

/** The user's reference pictures on a production, if any. */
export const referencePictures = (input: InputRecord | null | undefined) =>
  (input?.attachments ?? []).filter((attachment): attachment is Attachment & { key: string } => attachment.kind === "image" && Boolean(attachment.key));

/** Added to still prompts so the model treats the pictures as the look to match, not as content to copy. */
export const referencePrompt = (subject: string, count: number) =>
  count === 0
    ? subject
    : `${subject} Match the people, places, wardrobe, and visual style shown in the ${count === 1 ? "reference picture" : "reference pictures"}.`;
