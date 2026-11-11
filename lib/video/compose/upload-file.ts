import "server-only";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { getUpload } from "@/lib/storage/s3";
import { isOwnedUploadKey } from "@/lib/storage/upload-key";

/**
 * Puts one of the person's uploads on disk for ffmpeg, runs `work` on it, and removes
 * the copy afterwards. `dir` is a scratch folder `work` may also write its output into.
 */
export const withUploadFile = async <T>(
  userId: string,
  key: string,
  work: (file: string, dir: string) => Promise<T>,
): Promise<T> => {
  if (!isOwnedUploadKey(userId, key)) throw new Error("That upload isn't in your library.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-upload-"));
  try {
    const file = path.join(dir, `source${path.extname(key) || ".mp4"}`);
    await writeFile(file, (await getUpload(key)).bytes);
    return await work(file, dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** Length and streams of an uploaded clip. */
export const probeUpload = (userId: string, key: string) => withUploadFile(userId, key, (file) => probeFile(file));
