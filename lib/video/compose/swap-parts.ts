import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { probeFile, type MediaProbe } from "@/lib/production/review/ffmpeg";
import { putVideoMedia, signedVideoMediaUrl } from "../media-store";
import { swapEditConversion, swapParts, type SwapMethod, type SwapPart } from "../swap";
import { withUploadFile } from "./upload-file";

const execFileAsync = promisify(execFile);

/** ffmpeg's scene score above which a frame starts a new shot. */
const SCENE_THRESHOLD = 0.3;

/** Where part `index` of a long video is kept for Kling, next to the job's other files. */
export const swapPartKey = (jobId: string, index: number) => `${jobId}.swap-part-${index}.mp4`;

/** Times (seconds) where the video cuts to a new shot. Empty when it has none, or ffmpeg can't tell. */
export const sceneCutTimes = async (file: string) => {
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      ["-hide_banner", "-i", file, "-an", "-vf", `scale=320:-2,select='gt(scene,${SCENE_THRESHOLD})',showinfo`, "-f", "null", "-"],
      { timeout: 2 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 },
    );
    return [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map((match) => Number(match[1])).filter((time) => Number.isFinite(time));
  } catch (error) {
    console.error("Could not find scene cuts; splitting evenly", error);
    return [];
  }
};

/**
 * The parts a long video is swapped in, each within `limit` seconds, with joins moved onto the
 * video's own scene cuts where one is close. The same video always gives the same parts, so a
 * restarted job finds the parts it already made.
 */
export const planSwapParts = (userId: string, key: string, limit: number) =>
  withUploadFile(userId, key, async (source) => {
    const probe = await probeFile(source);
    if (!(probe.durationSec > 0)) throw new Error("We couldn't read the length of that video.");
    const cuts = probe.durationSec > limit ? await sceneCutTimes(source) : [];
    return swapParts(probe.durationSec, limit, cuts);
  });

/** Whole seconds Kling makes for a part: replacing pads the part's last frame up to the next second. */
export const swapPartTaskSeconds = (part: SwapPart) => Math.ceil(part.seconds - 1e-6);

/**
 * Cuts one part out of `source` into `output`. For replacing, the part gets the same size and frame-rate
 * fixes as a whole video, and its last frame (and silence) is held up to a whole second, because Kling
 * edits whole seconds.
 */
export const cutSwapPart = async (source: string, output: string, part: SwapPart, method: SwapMethod, probe: MediaProbe) => {
  const change = method === "replace" ? swapEditConversion(probe) : null;
  const hold = method === "replace" ? swapPartTaskSeconds(part) - part.seconds : 0;
  const video = [
    ...(change ? [`scale=${change.width}:${change.height}:flags=lanczos`, ...(change.fps ? [`fps=${change.fps}`] : [])] : []),
    ...(hold > 0.001 ? [`tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}`] : []),
  ];
  const sound = probe.hasAudio && hold > 0.001 ? [`apad=pad_dur=${hold.toFixed(3)}`] : [];
  await execFileAsync(
    "ffmpeg",
    [
      "-loglevel", "error", "-y",
      // Both before -i, so they choose what is read; the held frames are added after.
      "-ss", part.start.toFixed(3), "-t", part.seconds.toFixed(3), "-i", source,
      ...(video.length > 0 ? ["-vf", video.join(",")] : []),
      ...(sound.length > 0 ? ["-af", sound.join(",")] : []),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      ...(probe.hasAudio ? ["-c:a", "aac"] : ["-an"]),
      "-movflags", "+faststart",
      output,
    ],
    { timeout: 5 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 },
  );
};

/**
 * Cuts the given parts out of the uploaded video, saves each next to the job's files, and returns
 * a link Kling can fetch per part. The join trims the held frames off again.
 */
export const swapPartUrls = (
  userId: string,
  jobId: string,
  key: string,
  parts: readonly SwapPart[],
  indexes: readonly number[],
  method: SwapMethod,
  expiresIn: number,
) =>
  withUploadFile(userId, key, async (source, dir) => {
    const probe = await probeFile(source);
    const urls = new Map<number, string>();
    for (const index of indexes) {
      const part = parts[index];
      if (!part) throw new Error(`This swap has no part ${index + 1}.`);
      const output = path.join(dir, `part-${index}.mp4`);
      try {
        await cutSwapPart(source, output, part, method, probe);
      } catch (error) {
        console.error("Could not cut a part of the video for Kling", { jobId, index, error });
        throw new Error("We couldn't prepare that video for the swap. Try another file.");
      }
      const mediaKey = swapPartKey(jobId, index);
      await putVideoMedia(mediaKey, new Uint8Array(await readFile(output)), "video/mp4");
      const url = await signedVideoMediaUrl(mediaKey, expiresIn);
      if (!url) throw new Error("This server can't share the video with Kling. Set up file storage first.");
      urls.set(index, url);
    }
    return urls;
  });
