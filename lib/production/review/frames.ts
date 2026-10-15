import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { probeFile } from "./ffmpeg";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 60_000;

export interface VideoFrame {
  /** Seconds from the start of the clip. */
  timeSec: number;
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
}

export interface BoundaryFrames {
  /** Evenly spaced, scaled-down frames across the clip, in time order. */
  sampled: VideoFrame[];
  /** The exact final decoded frame at full resolution. */
  last: VideoFrame;
}

const withTempVideo = async <T>(video: Uint8Array, work: (input: string, dir: string) => Promise<T>) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-frames-"));
  try {
    const input = path.join(dir, "input.mp4");
    await writeFile(input, video);
    return await work(input, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/**
 * The exact final frame of the clip, lossless and at full resolution.
 * Only the last second is decoded; every frame overwrites one image, so the final write is the final frame.
 */
export const extractLastFrame = async (video: Uint8Array): Promise<VideoFrame> =>
  withTempVideo(video, async (input, dir) => {
    const { durationSec } = await probeFile(input);
    const output = path.join(dir, "last.png");
    await execFileAsync("ffmpeg", ["-y", "-sseof", "-1", "-i", input, "-update", "1", output], { timeout: TIMEOUT_MS });
    return { timeSec: durationSec, bytes: new Uint8Array(await readFile(output)), mime: "image/png" };
  });

/** Evenly spaced frames across the clip, scaled down so a reviewer can follow the action cheaply. */
export const sampleFrames = async (video: Uint8Array, count = 6, width = 640): Promise<VideoFrame[]> =>
  withTempVideo(video, async (input, dir) => {
    const { durationSec } = await probeFile(input);
    if (durationSec <= 0 || count <= 0) return [];
    const interval = durationSec / count;
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", input, "-vf", `fps=1/${interval},scale=${width}:-2`, "-frames:v", String(count), "-q:v", "3", path.join(dir, "frame-%03d.jpg")],
      { timeout: TIMEOUT_MS },
    );
    const names = (await readdir(dir)).filter((name) => name.startsWith("frame-")).sort();
    return Promise.all(
      names.map(async (name, index) => ({
        timeSec: Number((index * interval).toFixed(2)),
        bytes: new Uint8Array(await readFile(path.join(dir, name))),
        mime: "image/jpeg" as const,
      })),
    );
  });

/** Everything the reviewer needs to describe what the clip actually ended on. */
export const captureBoundaryFrames = async (video: Uint8Array, sampleCount = 6): Promise<BoundaryFrames> => {
  const [sampled, last] = await Promise.all([sampleFrames(video, sampleCount), extractLastFrame(video)]);
  return { sampled, last };
};
