import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { signedGetUrl } from "@/lib/storage/s3";
import { putVideoMedia, signedVideoMediaUrl } from "../media-store";
import { swapEditConversion } from "../swap";
import { withUploadFile } from "./upload-file";

const execFileAsync = promisify(execFile);

/** Where a converted copy of the video is kept for Kling, next to the job's other files. */
export const swapSourceKey = (jobId: string) => `${jobId}.swap-source.mp4`;

/**
 * A link Kling can fetch the video to edit from. Kling 3.0 Omni needs sides of 700 pixels or more
 * and 24 to 60 frames a second, so a small phone clip is scaled up first. A video that fits is sent as is.
 */
export const swapEditVideoUrl = (userId: string, jobId: string, key: string, expiresIn: number) =>
  withUploadFile(userId, key, async (source, dir) => {
    const probe = await probeFile(source);
    const change = swapEditConversion(probe);
    if (!change) return signedGetUrl(key, expiresIn);
    const output = path.join(dir, "kling-source.mp4");
    const filters = [`scale=${change.width}:${change.height}:flags=lanczos`, ...(change.fps ? [`fps=${change.fps}`] : [])];
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-loglevel",
          "error",
          "-y",
          "-i",
          source,
          "-vf",
          filters.join(","),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          output,
        ],
        { timeout: 5 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (error) {
      console.error("Could not prepare the video for Kling", error);
      throw new Error("We couldn't prepare that video for the swap. Try another file.");
    }
    const mediaKey = swapSourceKey(jobId);
    await putVideoMedia(mediaKey, new Uint8Array(await readFile(output)), "video/mp4");
    const url = await signedVideoMediaUrl(mediaKey, expiresIn);
    if (!url) throw new Error("This server can't share the video with Kling. Set up file storage first.");
    return url;
  });
