import "server-only";
import { execFile } from "node:child_process";
import { rename, unlink } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * AI mp4s usually have one keyframe and the moov atom at the end. The browser
 * then cannot scrub: currentTime updates but the painted frame stays put.
 * Re-encode with frequent keyframes and faststart so the editor can seek.
 */
export const prepareFootageForSeeking = async (filePath: string) => {
  const outputPath = `${filePath}.preview.mp4`;
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        filePath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-g",
        "12",
        "-keyint_min",
        "12",
        "-sc_threshold",
        "0",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { timeout: 120_000 },
    );
    await unlink(filePath);
    await rename(outputPath, filePath);
  } catch (error) {
    await unlink(outputPath).catch(() => undefined);
    throw error;
  }
};
