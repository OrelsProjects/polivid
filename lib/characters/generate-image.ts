import "server-only";
import { randomUUID } from "node:crypto";
import { createImageAdapter } from "@/lib/production/adapters/images";
import { defaultImageCapability } from "@/lib/production/capabilities";
import { putUpload } from "@/lib/storage/s3";
import { uploadFileUrl, uploadObjectKey } from "@/lib/storage/upload-key";

const portraitPrompt = (description: string) =>
  `Portrait of one person. ${description.trim()} Head and shoulders, facing the camera, even lighting, photorealistic, no text, no watermark, no logo.`;

export const generateCharacterImage = async (userId: string, description: string) => {
  const prompt = portraitPrompt(description);
  const job = await createImageAdapter().submit(
    {
      modelId: defaultImageCapability(true).modelId,
      prompt,
      format: "1:1",
    },
    randomUUID(),
  );
  const bytes = job.outputs[0]?.bytes;
  const mime = job.outputs[0]?.mime ?? "image/png";
  if (!bytes || bytes.byteLength === 0) throw new Error(job.error ?? "The picture didn't come back.");
  const imageKey = uploadObjectKey(userId, "png");
  await putUpload(imageKey, bytes, mime.startsWith("image/") ? mime : "image/png");
  return { imageKey, url: uploadFileUrl(imageKey), prompt };
};
