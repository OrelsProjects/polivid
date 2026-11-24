import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { toDataUrl } from "@/lib/storage/s3";
import { STUDIO_VOICE_ID } from "@/lib/voice/constants";
import { narrationAudio } from "@/lib/voice/speak";
import { assertVideoId, putVideoMedia, signedVideoMediaUrl } from "./media-store";
import type { VideoFormat } from "./schema";
import { cropForFormat } from "./talking-head-request";

const execFileAsync = promisify(execFile);

/** The voice track a talking-head clip was filmed to. Kept so a resumed job films the same words. */
export const talkingHeadAudioKey = (jobId: string) => `${assertVideoId(jobId)}.speech.mp3`;

const withTempDir = async <T>(work: (dir: string) => Promise<T>) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-talking-"));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** Seconds of audio or video in these bytes. */
export const mediaSeconds = (bytes: Uint8Array, extension: "mp3" | "mp4") =>
  withTempDir(async (dir) => {
    const file = path.join(dir, `media.${extension}`);
    await writeFile(file, bytes);
    return (await probeFile(file)).durationSec;
  });

/**
 * Avatar 6 keeps the picture's shape, so the picture is cropped to the video's shape first.
 * A picture that is already that shape, or that ffmpeg can't read, is sent as it is.
 */
export const framePicture = async (bytes: Uint8Array, contentType: string, format: VideoFormat) => {
  try {
    return await withTempDir(async (dir) => {
      const source = path.join(dir, "source");
      await writeFile(source, bytes);
      const probe = await probeFile(source);
      if (!probe.width || !probe.height) return toDataUrl(bytes, contentType);
      const crop = cropForFormat(probe.width, probe.height, format);
      if (Math.abs(crop.width - probe.width) <= 2 && Math.abs(crop.height - probe.height) <= 2) {
        return toDataUrl(bytes, contentType);
      }
      const output = path.join(dir, "framed.jpg");
      await execFileAsync("ffmpeg", [
        "-y",
        "-v",
        "error",
        "-i",
        source,
        "-vf",
        `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        output,
      ]);
      return toDataUrl(new Uint8Array(await readFile(output)), "image/jpeg");
    });
  } catch (error) {
    console.error("Could not crop the picture to the video's shape. Sending it as it is.", error);
    return toDataUrl(bytes, contentType);
  }
};

/**
 * The script in the character's voice. A character with no voice, or a photo with no character,
 * is read by the studio narrator, because a talking head always needs something to say.
 */
export const talkingHeadSpeech = async (userId: string, characterId: string | undefined, script: string) => {
  const own = await narrationAudio(userId, characterId, script);
  if (own) return own;
  const studio = await narrationAudio(userId, STUDIO_VOICE_ID, script);
  if (!studio) throw new Error("There are no words to say. Write the script first.");
  return studio;
};

/**
 * Stores the voice track and returns a link the video model can fetch.
 * Without S3 there is no public link, so the audio goes inline as a data URL.
 */
export const talkingHeadAudioUrl = async (jobId: string, speech: Uint8Array) => {
  const key = talkingHeadAudioKey(jobId);
  await putVideoMedia(key, speech, "audio/mpeg");
  return (await signedVideoMediaUrl(key)) ?? toDataUrl(speech, "audio/mpeg");
};
