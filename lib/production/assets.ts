import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getUpload, hasS3Config, putUpload } from "@/lib/storage/s3";

const LOCAL_DIR = path.join(process.cwd(), "data", "productions");
const ID = /^[0-9a-f-]{36}$/i;

export const productionObjectKey = (userId: string, productionId: string, assetId: string, ext: string) =>
  `productions/${userId}/${productionId}/${assetId}.${ext}`;

export const hashBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export const saveProductionBytes = async (
  userId: string,
  productionId: string,
  assetId: string,
  bytes: Uint8Array,
  mime: string,
) => {
  const ext = extFor(mime);
  const key = productionObjectKey(userId, productionId, assetId, ext);
  if (hasS3Config()) {
    await putUpload(key, bytes, mime);
  } else {
    const file = localPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  return { key, sha256: hashBytes(bytes) };
};

export const readProductionBytes = async (storageKey: string) => {
  if (hasS3Config() && storageKey.startsWith("productions/")) {
    return getUpload(storageKey);
  }
  const bytes = new Uint8Array(await readFile(localPath(storageKey)));
  return { bytes, contentType: mimeFor(storageKey) };
};

export const overwriteProductionBytes = async (storageKey: string, bytes: Uint8Array, mime: string) => {
  if (hasS3Config() && storageKey.startsWith("productions/")) {
    await putUpload(storageKey, bytes, mime);
    return;
  }
  const file = localPath(storageKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
};

const localPath = (key: string) => {
  const parts = key.split("/");
  if (parts.some((part) => part === ".." || part === "")) throw new Error("Invalid storage key.");
  return path.join(LOCAL_DIR, ...parts.slice(1));
};

const extFor = (mime: string) => {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("mp4")) return "mp4";
  return "bin";
};

const mimeFor = (key: string) => {
  const ext = key.split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "jpg") return "image/jpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "mp4") return "video/mp4";
  return "application/octet-stream";
};

export const isProductionAssetId = (id: string) => ID.test(id);
