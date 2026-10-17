import "server-only";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { rangedFileResponse, rangedStreamResponse, type RangedSource } from "@/lib/http/range";
import { deleteUpload, getObjectIfExists, hasS3Config, listObjectKeys, putUpload, signedGetUrl, statObject, streamObjectRange } from "@/lib/storage/s3";

/**
 * Filmed clips and what is derived from them (scrub stills, waveforms).
 * Kept in S3 under videos/ so every server instance sees them.
 * Without S3 settings they stay on local disk under data/media/, with the same layout.
 */
const LOCAL_DIR = path.join(process.cwd(), "data", "media");
export const VIDEO_MEDIA_PREFIX = "videos/";

const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isVideoId = (id: string) => VIDEO_ID.test(id);

export const assertVideoId = (id: string) => {
  if (!isVideoId(id)) throw new Error("Invalid video id.");
  return id;
};

/** Relative keys, e.g. `{id}.mp4`, `scrub/{id}/000.jpg`, `waveform/{id}.json`. */
const objectKey = (key: string) => `${VIDEO_MEDIA_PREFIX}${key}`;

const localPath = (key: string) => {
  const parts = key.split("/");
  if (parts.some((part) => part === ".." || part === "")) throw new Error("Invalid media key.");
  return path.join(LOCAL_DIR, ...parts);
};

/** HTTPS link for a stored video file. Null when files are only on this machine. */
export const signedVideoMediaUrl = (key: string, expiresIn = 2 * 60 * 60) => {
  if (!hasS3Config()) return Promise.resolve(null);
  return signedGetUrl(objectKey(key), expiresIn);
};

export const putVideoMedia = async (key: string, bytes: Uint8Array, contentType: string) => {
  if (hasS3Config()) {
    await putUpload(objectKey(key), bytes, contentType);
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
};

export const readVideoMedia = async (key: string): Promise<Uint8Array | null> => {
  if (hasS3Config()) return (await getObjectIfExists(objectKey(key)))?.bytes ?? null;
  const file = localPath(key);
  if (!existsSync(file)) return null;
  return new Uint8Array(await readFile(file));
};

/** Every stored key under a relative prefix, e.g. `songs/` lists all song drafts and audio. */
export const listVideoMediaKeys = async (prefix: string): Promise<string[]> => {
  if (hasS3Config()) {
    const keys = await listObjectKeys(objectKey(prefix));
    return keys.map((key) => key.slice(VIDEO_MEDIA_PREFIX.length));
  }
  const parts = prefix.split("/").filter(Boolean);
  const root = path.join(LOCAL_DIR, ...parts);
  const walk = async (dir: string, base: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
    if (!entries) return [];
    const found: string[] = [];
    for (const entry of entries) {
      const relative = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) found.push(...(await walk(path.join(dir, entry.name), relative)));
      else if (entry.isFile()) found.push(relative);
    }
    return found;
  };
  const found = await walk(root, parts.join("/"));
  return found.sort();
};

export const hasVideoMedia = async (key: string) => {
  if (hasS3Config()) return (await statObject(objectKey(key))) !== null;
  return existsSync(localPath(key));
};

export const deleteVideoMedia = async (key: string) => {
  if (hasS3Config()) {
    await deleteUpload(objectKey(key));
    return;
  }
  const file = localPath(key);
  if (!existsSync(file)) return;
  await unlink(file);
};

/** Streams a stored file and honors Range. Null when the file doesn't exist. */
export const videoMediaResponse = async (
  key: string,
  contentType: string,
  rangeHeader: string | null,
  cacheControl?: string,
) => {
  if (!hasS3Config()) {
    const file = localPath(key);
    if (!existsSync(file)) return null;
    return rangedFileResponse(file, contentType, rangeHeader, cacheControl);
  }
  const object = await statObject(objectKey(key));
  if (!object) return null;
  const source: RangedSource = {
    size: object.size,
    etag: object.etag,
    contentType,
    open: (start, end) => streamObjectRange(objectKey(key), start, end),
  };
  return rangedStreamResponse(source, rangeHeader, cacheControl);
};
