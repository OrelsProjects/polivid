import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { hasScribe, transcribeWords } from "@/lib/ai/scribe";
import { transcribeMedia } from "@/lib/ai/transcribe";
import { applyCaptionPreset, captionPresetById } from "@/lib/editor/caption-presets";
import { spokenWordsForVideo } from "@/lib/editor/caption-speech";
import { db } from "@/lib/db";
import { renderEditProject } from "@/lib/editor/render";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { toDataUrl } from "@/lib/storage/s3";
import { isVideoKey } from "@/lib/storage/upload-key";
import { saveVideoForJob } from "@/lib/videos";
import {
  captionLinesFromWords,
  closestFormat,
  evenCaptionLines,
  MAX_CAPTION_SECONDS,
  type CaptionLine,
  type CaptioningSettings,
} from "../captions";
import { FootageStopped } from "../footage";
import { markVideoJobProgress, transitionVideoJob } from "../jobs";
import { FPS, type ScenePlan, type VideoFormat } from "../schema";
import { isStillRunning, readyRecord, type JobInput } from "../worker-support";
import { withRenderSlot } from "./render-slot";
import { buildCaptionedTimeline } from "./timeline";
import { withUploadFile } from "./upload-file";

const execFileAsync = promisify(execFile);

const RENDER_FROM = 40;
const RENDER_TO = 98;

interface CaptionProgress {
  lines: CaptionLine[];
  seconds: number;
  format: VideoFormat;
}

const readProgress = (artifacts: unknown): CaptionProgress | null => {
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return null;
  const saved = (artifacts as Record<string, unknown>).captions;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const record = saved as Record<string, unknown>;
  const lines = Array.isArray(record.lines)
    ? record.lines.filter(
        (line): line is CaptionLine =>
          Boolean(line) &&
          typeof line === "object" &&
          typeof (line as CaptionLine).text === "string" &&
          typeof (line as CaptionLine).start === "number" &&
          typeof (line as CaptionLine).end === "number",
      )
    : [];
  const format = record.format;
  if (lines.length === 0 || typeof record.seconds !== "number") return null;
  if (format !== "9:16" && format !== "1:1" && format !== "16:9") return null;
  return { lines, seconds: record.seconds, format };
};

/**
 * Listens to the upload and works out the caption lines. Word-level timing is used when
 * it is available. Without it the transcript is spread evenly, which still reads but
 * does not follow the voice as closely.
 */
const transcribe = async (userId: string, key: string): Promise<CaptionProgress> =>
  withUploadFile(userId, key, async (source, dir) => {
    const probe = await probeFile(source);
    if (!probe.hasVideo) throw new Error("That file has no picture to caption.");
    if (!probe.hasAudio) throw new Error("That video has no sound, so there is nothing to caption.");
    if (probe.durationSec > MAX_CAPTION_SECONDS) {
      throw new Error(`That video is longer than ${MAX_CAPTION_SECONDS / 60} minutes. Trim it first.`);
    }
    const audio = path.join(dir, "speech.mp3");
    await execFileAsync(
      "ffmpeg",
      ["-loglevel", "error", "-y", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio],
      { timeout: 5 * 60 * 1000 },
    );
    const bytes = new Uint8Array(await readFile(audio));
    const format = closestFormat(probe.width, probe.height);
    if (hasScribe()) {
      try {
        const { words } = await transcribeWords(bytes);
        return { lines: captionLinesFromWords(words), seconds: probe.durationSec, format };
      } catch (error) {
        console.error("Word-level transcription failed. Falling back to an untimed transcript.", error);
      }
    }
    const text = await transcribeMedia(toDataUrl(bytes, "audio/mpeg"), "audio/mpeg");
    return { lines: evenCaptionLines(text, probe.durationSec, FPS), seconds: probe.durationSec, format };
  });

/** A plan needs each scene to run between 2 and 12 seconds, so the captions are listed in runs of that size. */
const scenesFor = (title: string, progress: CaptionProgress): ScenePlan["scenes"] => {
  const count = Math.max(1, Math.ceil(progress.seconds / 12));
  const each = progress.seconds / count;
  return Array.from({ length: count }, (_, index) => ({
    type: "footage" as const,
    headline: title,
    narration: progress.lines
      .filter((line) => line.start >= index * each && line.start < (index + 1) * each)
      .map((line) => line.text)
      .join(" "),
    factIds: [],
    quote: null,
    durationSec: Math.min(12, Math.max(2, Number(each.toFixed(2)))),
  }));
};

/**
 * The caption lines of one of the person's finished videos. The take's words were timed when it
 * was made or laid out, so they are reused; otherwise the script is spread over its length.
 */
const listenToFinished = async (userId: string, settings: CaptioningSettings): Promise<CaptionProgress> => {
  const video = await db.video.findFirst({
    where: { id: settings.sourceVideoId, userId },
    select: { length: true, format: true, status: true },
  });
  if (!video || video.status !== "ready") throw new Error("That video isn't in your library anymore.");
  const format = video.format === "1:1" || video.format === "16:9" ? video.format : "9:16";
  const words = await spokenWordsForVideo(userId, settings.sourceVideoId);
  return { lines: captionLinesFromWords(words), seconds: video.length, format };
};

/** Captions an uploaded video: the words are transcribed, timed, and drawn into the picture. */
export const composeCaptions = async (userId: string, jobId: string, input: JobInput) => {
  const finished = input.captioning;
  const key = input.mediaKey;
  if (!finished && (!key || !isVideoKey(key))) throw new Error("Upload a video to caption.");
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId }, select: { artifacts: true } });
  let progress = readProgress(job?.artifacts);
  if (!progress) {
    if (!(await markVideoJobProgress(jobId, "script", 10))) return;
    progress = finished ? await listenToFinished(userId, finished) : await transcribe(userId, key!);
    if (progress.lines.length === 0) throw new Error("No speech was found in that video.");
    const current =
      job?.artifacts && typeof job.artifacts === "object" && !Array.isArray(job.artifacts)
        ? (job.artifacts as Record<string, unknown>)
        : {};
    await db.videoJob.update({
      where: { id: jobId },
      data: {
        artifacts: {
          ...current,
          captions: {
            seconds: progress.seconds,
            format: progress.format,
            lines: progress.lines.map((line) => ({ text: line.text, start: line.start, end: line.end })),
          },
        },
      },
    });
  }
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();

  const plain = buildCaptionedTimeline({
    format: progress.format,
    ...(finished ? { videoId: finished.sourceVideoId } : { videoKey: key }),
    seconds: progress.seconds,
    lines: progress.lines,
  });
  // A preset re-cuts the lines to its own length when the words are timed, and gives them its look.
  const timeline = finished?.preset && captionPresetById(finished.preset) ? applyCaptionPreset(plain, finished.preset) : plain;
  if (!(await markVideoJobProgress(jobId, "render", RENDER_FROM))) return;
  await withRenderSlot(() => renderEditProject(userId, jobId, timeline, { from: RENDER_FROM, to: RENDER_TO }));
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();

  const length = Math.max(2, Math.round(progress.seconds));
  const title = "Captioned video";
  await saveVideoForJob(userId, {
    ...readyRecord(jobId, { ...input, format: progress.format }, { title, scenes: scenesFor(title, progress) }, length, false),
    ...(finished ? { parentVideoId: finished.sourceVideoId } : {}),
  });
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: `/api/videos/${jobId}/file`, error: null });
};
