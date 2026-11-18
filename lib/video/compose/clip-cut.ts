import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { putUpload } from "@/lib/storage/s3";
import type { ClipRange } from "../clip-edit";
import { withUploadFile } from "./upload-file";

const execFileAsync = promisify(execFile);

/**
 * Where the cut version of an upload is kept: in the person's own uploads, named for the job, so the
 * swap reads it like any upload and a restarted job writes the same file.
 */
export const cutUploadKey = (userId: string, jobId: string) => `uploads/${userId}/videos/${jobId}.mp4`;

/** ffmpeg arguments that keep `ranges` of `source`, in order, joined into `output`. */
export const clipCutArgs = (source: string, output: string, ranges: readonly ClipRange[], hasAudio: boolean) => {
  const filters: string[] = [];
  const joins: string[] = [];
  for (const [index, range] of ranges.entries()) {
    const span = `start=${range.start.toFixed(3)}:end=${range.end.toFixed(3)}`;
    filters.push(`[0:v]trim=${span},setpts=PTS-STARTPTS[v${index}]`);
    if (hasAudio) filters.push(`[0:a]atrim=${span},asetpts=PTS-STARTPTS[a${index}]`);
    joins.push(hasAudio ? `[v${index}][a${index}]` : `[v${index}]`);
  }
  filters.push(`${joins.join("")}concat=n=${ranges.length}:v=1:a=${hasAudio ? 1 : 0}${hasAudio ? "[v][a]" : "[v]"}`);
  return [
    "-loglevel", "error", "-y",
    "-i", source,
    "-filter_complex", filters.join(";"),
    "-map", "[v]",
    ...(hasAudio ? ["-map", "[a]", "-c:a", "aac"] : []),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    output,
  ];
};

/** Cuts `source` down to `ranges` on disk. */
export const cutClipFile = async (source: string, output: string, ranges: readonly ClipRange[]) => {
  const probe = await probeFile(source);
  await execFileAsync("ffmpeg", clipCutArgs(source, output, ranges, probe.hasAudio), {
    timeout: 5 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
  });
};

/** Makes the cut version of an upload for this job and returns its key. */
export const cutUpload = (userId: string, jobId: string, key: string, ranges: readonly ClipRange[]) =>
  withUploadFile(userId, key, async (source, dir) => {
    const output = path.join(dir, "cut.mp4");
    try {
      await cutClipFile(source, output, ranges);
    } catch (error) {
      console.error("Could not cut the uploaded video", { jobId, error });
      throw new Error("We couldn't cut that video. Try cutting it again, or upload another file.");
    }
    const cutKey = cutUploadKey(userId, jobId);
    await putUpload(cutKey, new Uint8Array(await readFile(output)), "video/mp4");
    return cutKey;
  });
