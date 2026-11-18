import "server-only";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { upscaleAspectFor, upscaleCanvasFor, upscalePicture } from "@/lib/images/upscale";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { signedGetUrl } from "@/lib/storage/s3";
import { isOwnedUploadKey } from "@/lib/storage/upload-key";
import { putVideoMedia, signedVideoMediaUrl } from "../media-store";
import { swapEditConversion, swapPictureConversion } from "../swap";
import { withUploadFile } from "./upload-file";

const execFileAsync = promisify(execFile);

/** Where a converted copy of the video is kept for Kling, next to the job's other files. */
export const swapSourceKey = (jobId: string) => `${jobId}.swap-source.mp4`;

/**
 * A link Kling can fetch the video to edit from. Kling 3.0 Omni needs sides of 700 pixels or more
 * and 24 to 60 frames a second, so a small phone clip is scaled up first. A video that fits is sent as is.
 * A video longer than one task takes is split into parts first (swapPartUrl).
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

/** Where a fitted copy of the character picture is kept for Kling, next to the job's other files. */
export const swapPictureKey = (jobId: string) => `${jobId}.swap-picture.jpg`;

/** Under this short side a picture is upscaled with AI before it is fitted. */
const AI_UPSCALE_BELOW = 512;
/** An upscale that comes back smaller than this short side is thrown away. */
const AI_UPSCALE_MIN_RESULT = 768;

const runFfmpeg = (args: string[]) =>
  execFileAsync("ffmpeg", ["-loglevel", "error", "-y", ...args], { timeout: 60 * 1000, maxBuffer: 8 * 1024 * 1024 });

/**
 * Redraws a small picture at 2K with the AI upscaler, first padding it with white to the shape it is
 * asked for. Returns the new file and its size, or null when the upscaler fails, so the caller resizes instead.
 */
const aiUpscale = async (source: string, dir: string, width: number, height: number) => {
  try {
    const aspect = upscaleAspectFor(width, height);
    const canvas = upscaleCanvasFor(width, height, aspect);
    const padded = path.join(dir, "upscale-in.png");
    await runFfmpeg(["-i", source, "-vf", `pad=${canvas.width}:${canvas.height}:(ow-iw)/2:(oh-ih)/2:color=white`, "-frames:v", "1", padded]);
    const result = await upscalePicture(new Uint8Array(await readFile(padded)), "image/png", aspect);
    const extension = result.mime.includes("jpeg") ? ".jpg" : result.mime.includes("webp") ? ".webp" : ".png";
    const output = path.join(dir, `upscaled${extension}`);
    await writeFile(output, result.bytes);
    const probe = await probeFile(output);
    if (!probe.width || !probe.height || Math.min(probe.width, probe.height) < AI_UPSCALE_MIN_RESULT) {
      throw new Error(`The upscaler returned ${probe.width}x${probe.height}.`);
    }
    console.info("Upscaled a character picture", { from: `${width}x${height}`, to: `${probe.width}x${probe.height}`, usd: result.usd });
    return { file: output, width: probe.width, height: probe.height };
  } catch (error) {
    console.error("AI upscale failed; resizing the picture instead", error);
    return null;
  }
};

/**
 * A link Kling can fetch the character picture from. Kling turns down pictures under 300 pixels a side
 * or narrower than 1:2.5 ("Image pixel is invalid"). A small picture is upscaled with AI (a plain resize
 * if that fails), and an odd shape gets plain margins. A picture that fits is sent as is.
 */
export const swapPictureUrl = async (userId: string, jobId: string, key: string, expiresIn: number) => {
  // A picture outside the person's uploads (a shared library character) is sent as it is.
  if (!isOwnedUploadKey(userId, key)) return signedGetUrl(key, expiresIn);
  return withUploadFile(userId, key, async (original, dir) => {
    let source = original;
    let probe = await probeFile(source);
    if (!swapPictureConversion(probe.width, probe.height)) return signedGetUrl(key, expiresIn);
    if (probe.width && probe.height && Math.min(probe.width, probe.height) < AI_UPSCALE_BELOW) {
      const upscaled = await aiUpscale(source, dir, probe.width, probe.height);
      if (upscaled) {
        source = upscaled.file;
        probe = { ...probe, width: upscaled.width, height: upscaled.height };
      }
    }
    // An upscaled picture may already fit; it is still re-encoded at even sides, which JPEG needs.
    const evenDown = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
    const fit = swapPictureConversion(probe.width, probe.height) ?? {
      width: evenDown(probe.width!),
      height: evenDown(probe.height!),
      canvasWidth: evenDown(probe.width!),
      canvasHeight: evenDown(probe.height!),
    };
    const output = path.join(dir, "kling-picture.jpg");
    const filters = [
      `scale=${fit.width}:${fit.height}:flags=lanczos`,
      `pad=${fit.canvasWidth}:${fit.canvasHeight}:(ow-iw)/2:(oh-ih)/2:color=white`,
    ];
    try {
      await runFfmpeg(["-i", source, "-vf", filters.join(","), "-frames:v", "1", "-q:v", "2", output]);
    } catch (error) {
      console.error("Could not fit the character picture for Kling", error);
      throw new Error("We couldn't prepare the character's picture for the swap. Try another picture.");
    }
    const mediaKey = swapPictureKey(jobId);
    await putVideoMedia(mediaKey, new Uint8Array(await readFile(output)), "image/jpeg");
    const url = await signedVideoMediaUrl(mediaKey, expiresIn);
    if (!url) throw new Error("This server can't share the picture with Kling. Set up file storage first.");
    return url;
  });
};
