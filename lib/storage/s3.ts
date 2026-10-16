import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

/**
 * Vercel sets AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION to its own function role,
 * and that role can't reach our bucket. Only the app's own names are read.
 */
const firstEnv = (...names: string[]) => names.map((name) => process.env[name]?.trim()).find(Boolean) ?? "";
const bucketName = () => firstEnv("AWS_S3_BUCKET");
const region = () => firstEnv("AWS_REGION_APP", "POLIVID_AWS_REGION") || "us-east-1";
const accessKeyId = () => firstEnv("AWS_ACCESS_KEY_APP", "AWS_ACCESS_KEY");
const secretAccessKey = () => firstEnv("AWS_SECRET_KEY_APP", "AWS_SECRET_KEY");

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

/** A temporary HTTPS link so a video model can fetch a private object. */
export const signedGetUrl = (key: string, expiresIn = 60 * 60) =>
  getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucketName(), Key: key }), { expiresIn });

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

/** Size and type of an object, or null when it doesn't exist. */
export const statObject = async (key: string) => {
  try {
    const response = await s3().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? "application/octet-stream",
      etag: response.ETag ?? null,
    };
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return null;
    throw error;
  }
};

/** Streams bytes start..end (inclusive) of an object. */
export const streamObjectRange = async (key: string, start: number, end: number) => {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: bucketName(), Key: key, Range: `bytes=${start}-${end}` }),
  );
  if (!response.Body) throw new Error("The stored file is missing.");
  return response.Body.transformToWebStream();
};

export const getObjectIfExists = async (key: string) => {
  try {
    return await getUpload(key);
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
};

export type StoredUpload = { key: string; size: number; uploadedAt: Date | null };

const listObjects = async (prefix: string, limit = Number.POSITIVE_INFINITY) => {
  const items: StoredUpload[] = [];
  let token: string | undefined;
  do {
    const response = await s3().send(
      new ListObjectsV2Command({
        Bucket: bucketName(),
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of response.Contents ?? []) {
      if (!object.Key) continue;
      items.push({ key: object.Key, size: object.Size ?? 0, uploadedAt: object.LastModified ?? null });
    }
    token = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (token && items.length < limit);
  return items;
};

/** Every key under `prefix`. */
export const listObjectKeys = async (prefix: string) => (await listObjects(prefix)).map((object) => object.key);

/** Everything under uploads/{userId}/, newest first. */
export const listUploads = async (userId: string) => {
  const items = await listObjects(uploadPrefix(userId), MAX_LISTED_UPLOADS);
  return items.sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0));
};

export const deleteUpload = async (key: string) => {
  await s3().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
};

export const toDataUrl = (bytes: Uint8Array, contentType: string) => {
  const binary = Buffer.from(bytes).toString("base64");
  return `data:${contentType};base64,${binary}`;
};
