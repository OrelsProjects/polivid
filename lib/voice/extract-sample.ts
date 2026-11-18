import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { MAX_VOICE_UPLOAD_SECONDS } from "./constants";

const execFileAsync = promisify(execFile);

/** Matches the browser's mono WAV extraction for uploaded video references. */
export const extractVoiceSample = async (file: string, directory: string) => {
  const output = path.join(directory, "voice-sample.wav");
  try {
    await execFileAsync("ffmpeg", [
      "-nostdin", "-y", "-loglevel", "error",
      "-protocol_whitelist", "file,pipe", "-i", file,
      "-t", String(MAX_VOICE_UPLOAD_SECONDS), "-map", "0:a:0", "-vn",
      "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le", output,
    ], { timeout: 45_000, maxBuffer: 512_000 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Video audio extraction is unavailable on this server. Use Upload a recording on the Characters page to extract it in your browser.");
    }
    throw new Error("Couldn't extract audio from that video. Use a playable MP4, MOV, or WebM with speech.");
  }
  return { bytes: new Uint8Array(await readFile(output)), type: "audio/wav", name: "voice-sample.wav" };
};
