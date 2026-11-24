import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { hasScribe, transcribeWords } from "@/lib/ai/scribe";
import { db } from "@/lib/db";
import { transcribeMedia } from "@/lib/ai/transcribe";
import { toDataUrl } from "@/lib/storage/s3";
import { footageKey } from "@/lib/video/footage";
import { readVideoMedia } from "@/lib/video/media-store";
import { probeFile } from "@/lib/production/review/ffmpeg";
import type { TimedWord } from "@/lib/video/captions";

const execFileAsync = promisify(execFile);

/** Timed words saved on the video's job, so a video is only listened to once. */
const SPOKEN_WORDS = "spokenWords";

const isTimedWord = (value: unknown): value is TimedWord =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as TimedWord).text === "string" &&
  typeof (value as TimedWord).start === "number" &&
  typeof (value as TimedWord).end === "number";

const savedWords = (artifacts: unknown) => {
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return null;
  const saved = (artifacts as Record<string, unknown>)[SPOKEN_WORDS];
  if (!saved || typeof saved !== "object") return null;
  const words = (saved as { words?: unknown }).words;
  return Array.isArray(words) && words.length > 0 && words.every(isTimedWord) ? words : null;
};

/**
 * Every word said in a video, with when it is said, in seconds. The first call listens to the
 * video and saves the result on its job in the database; later calls read it back, so adding
 * captions again, or laying the video out, never pays to listen twice. A video's file never
 * changes after it is made, so the saved words stay right.
 */
export const spokenWordsForVideo = async (userId: string, videoId: string): Promise<TimedWord[]> => {
  const job = await db.videoJob.findFirst({ where: { id: videoId, userId }, select: { artifacts: true } });
  const saved = savedWords(job?.artifacts);
  if (saved) return saved;
  const { words, timed } = await listenToVideo(videoId);
  // Only word-level timing is worth keeping. An evenly spread guess is made again next time,
  // in case word timing is set up by then.
  if (job && timed && words.length > 0) {
    const fresh = await db.videoJob.findUnique({ where: { id: videoId }, select: { artifacts: true } });
    const current =
      fresh?.artifacts && typeof fresh.artifacts === "object" && !Array.isArray(fresh.artifacts)
        ? (fresh.artifacts as Record<string, unknown>)
        : {};
    await db.videoJob.update({
      where: { id: videoId },
      data: { artifacts: { ...current, [SPOKEN_WORDS]: { words: words.map((word) => ({ ...word })), at: new Date().toISOString() } } },
    });
  }
  return words;
};

/**
 * Every word said in a video's file, with when it is said, in seconds. Uses word-level
 * speech-to-text when it is set up. Otherwise the transcript is spread evenly over the video,
 * which still makes captions, only less exactly timed. Empty when there is no speech.
 */
const listenToVideo = async (videoId: string): Promise<{ words: TimedWord[]; timed: boolean }> => {
  const bytes = await readVideoMedia(footageKey(videoId));
  if (!bytes) throw new Error("That video has no file to caption.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-captions-"));
  try {
    const source = path.join(dir, "video.mp4");
    await writeFile(source, bytes);
    const probe = await probeFile(source);
    if (!probe.hasAudio) return { words: [], timed: false };
    const audioPath = path.join(dir, "speech.mp3");
    await execFileAsync("ffmpeg", ["-loglevel", "error", "-y", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audioPath]);
    const audio = new Uint8Array(await readFile(audioPath));
    if (hasScribe()) {
      try {
        return { words: (await transcribeWords(audio)).words, timed: true };
      } catch (error) {
        console.error("Word-level transcription failed. Spreading the transcript evenly.", error);
      }
    }
    const text = await transcribeMedia(toDataUrl(audio, "audio/mpeg"), "audio/mpeg");
    const words = text.split(/\s+/).filter(Boolean);
    const each = probe.durationSec / Math.max(1, words.length);
    return { words: words.map((word, index) => ({ text: word, start: index * each, end: (index + 0.9) * each })), timed: false };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
