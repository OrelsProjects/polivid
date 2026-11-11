import "server-only";
import { randomUUID } from "node:crypto";
import { createImageAdapter, ImageTimeoutError } from "@/lib/production/adapters/images";
import { defaultImageCapability } from "@/lib/production/capabilities";
import { mimeForUploadKey } from "@/lib/production/references";
import { getUpload, putUpload } from "@/lib/storage/s3";
import { isImageKey, isOwnedUploadKey, uploadFileUrl, uploadObjectKey } from "@/lib/storage/upload-key";
import type { VideoFormat } from "@/lib/video/schema";

/** Tries after the first. Every try gets the adapter's 90 second window. */
const IMAGE_RETRIES = 2;

const loadPicture = async (userId: string, key: string) => {
  if (!isOwnedUploadKey(userId, key) || !isImageKey(key)) {
    throw new Error("Use a picture from your own library.");
  }
  const file = await getUpload(key);
  return { bytes: file.bytes, mime: file.contentType.startsWith("image/") ? file.contentType : mimeForUploadKey(key) };
};

/**
 * Generates or edits a still and stores it under the person's uploads.
 * Edits pass the source as a subject reference. The image adapter sends subject and style
 * references, and ignores a first-frame role, so that is the path that actually edits.
 */
export const generateImage = async (
  userId: string,
  input: {
    prompt: string;
    format?: VideoFormat;
    referenceKeys?: string[];
    sourceKey?: string;
    /** A person who should appear in a new picture. Does not turn the call into an edit. */
    subjectKey?: string;
    /** Use the faster draft model. Storyboard frames are drafts, so they skip the final-quality model. */
    draft?: boolean;
  },
) => {
  const refs = [];
  if (input.sourceKey) {
    const source = await loadPicture(userId, input.sourceKey);
    refs.push({ role: "subject_ref" as const, bytes: source.bytes, mime: source.mime });
  } else if (input.subjectKey) {
    const subject = await loadPicture(userId, input.subjectKey);
    refs.push({ role: "subject_ref" as const, bytes: subject.bytes, mime: subject.mime });
  }
  for (const key of input.referenceKeys ?? []) {
    if (key === input.sourceKey || key === input.subjectKey) continue;
    const reference = await loadPicture(userId, key);
    refs.push({ role: "style_ref" as const, bytes: reference.bytes, mime: reference.mime });
  }
  const prompt = input.sourceKey
    ? `Edit this picture. ${input.prompt.trim()} Keep the same person unless the request says otherwise. No text, no watermark, no logo.`
    : input.prompt.trim();
  const request = {
    modelId: defaultImageCapability(!input.draft).modelId,
    prompt,
    format: input.format ?? "1:1",
    refs,
  };
  const adapter = createImageAdapter();
  let job;
  for (let attempt = 0; ; attempt += 1) {
    try {
      job = await adapter.submit(request, randomUUID());
      break;
    } catch (error) {
      if (!(error instanceof ImageTimeoutError) || attempt >= IMAGE_RETRIES) throw error;
    }
  }
  const bytes = job.outputs[0]?.bytes;
  const mime = job.outputs[0]?.mime ?? "image/png";
  if (!bytes || bytes.byteLength === 0) throw new Error(job.error ?? "The picture didn't come back.");
  const imageKey = uploadObjectKey(userId, "png");
  await putUpload(imageKey, bytes, mime.startsWith("image/") ? mime : "image/png");
  return { imageKey, url: uploadFileUrl(imageKey), prompt };
};
