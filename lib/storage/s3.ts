import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { uploadPrefix } from "./upload-key";

export { isOwnedUploadKey, uploadObjectKey } from "./upload-key";

const MAX_LISTED_UPLOADS = 500;

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_MEDIA_BYTES;
export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const hasS3Config = () => Boolean(bucketName() && accessKeyId() && secretAccessKey());

const bucketName = () => process.env.AWS_S3_BUCKET?.trim() ?? "";
const region = () => process.env.AWS_REGION_APP?.trim() || process.env.AWS_REGION?.trim() || "us-east-1";
const accessKeyId = () => process.env.AWS_ACCESS_KEY_APP?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim() || "";
const secretAccessKey = () => process.env.AWS_SECRET_KEY_APP?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim() || "";

let client: S3Client | null = null;

const s3 = () => {
  if (!hasS3Config()) {
    throw new Error("S3 is not configured. Set AWS_S3_BUCKET and the existing AWS app keys.");
  }
  if (!client) {
    client = new S3Client({
      region: region(),
      credentials: {
        accessKeyId: accessKeyId(),
        secretAccessKey: secretAccessKey(),
      },
    });
  }
  return client;
};

export const putUpload = async (key: string, bytes: Uint8Array, contentType: string) => {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
};

export const getUpload = async (key: string) => {
  const response = await s3().send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key,
    }),
  );
  const body = response.Body;
  if (!body) throw new Error("The uploaded picture is missing.");
  const bytes = new Uint8Array(await body.transformToByteArray());
  const contentType = response.ContentType ?? "application/octet-stream";
  return { bytes, contentType };
};

export type StoredUpload = { key: string; size: number; uploadedAt: Date | null };

/** Everything under uploads/{userId}/, newest first. */
export const listUploads = async (userId: string) => {
  const items: StoredUpload[] = [];
  let token: string | undefined;
  do {
    const response = await s3().send(
      new ListObjectsV2Command({
        Bucket: bucketName(),
        Prefix: uploadPrefix(userId),
        ContinuationToken: token,
      }),
    );
    for (const object of response.Contents ?? []) {
      if (!object.Key) continue;
      items.push({ key: object.Key, size: object.Size ?? 0, uploadedAt: object.LastModified ?? null });
    }
    token = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (token && items.length < MAX_LISTED_UPLOADS);
  return items.sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0));
};

export const deleteUpload = async (key: string) => {
  await s3().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
};

export const toDataUrl = (bytes: Uint8Array, contentType: string) => {
  const binary = Buffer.from(bytes).toString("base64");
  return `data:${contentType};base64,${binary}`;
};
