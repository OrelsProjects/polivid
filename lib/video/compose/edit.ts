import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { isVideoKey } from "@/lib/storage/upload-key";
import { saveVideoForJob } from "@/lib/videos";
import { describeEdit, editFfmpegArgs, editValueFor, isEditOp } from "../edit-ops";
import { FootageStopped, saveFootage } from "../footage";
import { markVideoJobProgress, transitionVideoJob } from "../jobs";
import type { ScenePlan } from "../schema";
import { isStillRunning, readyRecord, type JobInput } from "../worker-support";
import { withUploadFile } from "./upload-file";

const execFileAsync = promisify(execFile);

/** A plan needs each scene to run between 2 and 12 seconds, so a long result is listed as several. */
const scenesFor = (title: string, seconds: number): ScenePlan["scenes"] => {
  const count = Math.max(1, Math.ceil(seconds / 12));
  const each = Math.min(12, Math.max(2, Number((seconds / count).toFixed(2))));
  return Array.from({ length: count }, () => ({
    type: "footage" as const,
    headline: title,
    narration: "",
    factIds: [],
    quote: null,
    durationSec: each,
  }));
};

/** Makes one quick edit to an uploaded video and saves the result as a new video. */
export const composeEdit = async (userId: string, jobId: string, input: JobInput) => {
  const key = input.mediaKey;
  if (!key || !isVideoKey(key)) throw new Error("Upload a video to edit.");
  if (!isEditOp(input.op)) throw new Error("Pick what to change.");
  const op = input.op;
  const value = editValueFor(op, input.opValue);
  if (!(await markVideoJobProgress(jobId, "render", 20))) return;

  const result = await withUploadFile(userId, key, async (source, dir) => {
    const before = await probeFile(source);
    if (!before.hasVideo) throw new Error("That file has no picture to edit.");
    const output = path.join(dir, "edited.mp4");
    try {
      await execFileAsync("ffmpeg", ["-loglevel", "error", ...editFfmpegArgs({ op, value, source, output, hasAudio: before.hasAudio })], {
        timeout: 10 * 60 * 1000,
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch (error) {
      console.error("Quick edit failed", error);
      throw new Error("We couldn't edit that video. Try another file, or a different setting.");
    }
    const after = await probeFile(output);
    return { bytes: new Uint8Array(await readFile(output)), seconds: after.durationSec };
  });

  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();
  await markVideoJobProgress(jobId, "render", 80);
  await saveFootage(jobId, result.bytes);
  const length = Math.max(2, Math.round(result.seconds));
  const title = describeEdit(op, value);
  await saveVideoForJob(userId, readyRecord(jobId, input, { title, scenes: scenesFor(title, result.seconds) }, length, false));
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: `/api/videos/${jobId}/file`, error: null });
};
