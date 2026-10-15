import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { withFootageFile } from "./footage";
import { assertVideoId, putVideoMedia, readVideoMedia } from "./media-store";

const execFileAsync = promisify(execFile);

export const WAVEFORM_RATE = 80;

export interface WaveformMeta {
  rate: number;
  hasAudio: boolean;
  peaks: number[];
}

const waveformKey = (id: string) => `waveform/${assertVideoId(id)}.json`;

export const readWaveform = async (id: string): Promise<WaveformMeta | null> => {
  const bytes = await readVideoMedia(waveformKey(id));
  return bytes ? (JSON.parse(Buffer.from(bytes).toString("utf8")) as WaveformMeta) : null;
};

const writeWaveform = async (id: string, meta: WaveformMeta) => {
  await putVideoMedia(waveformKey(id), new TextEncoder().encode(JSON.stringify(meta)), "application/json");
  return meta;
};

const isMissingFfmpeg = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code === "ENOENT";

/** Reads peaks from the clip and stores them. Pass `sourceFile` when a local copy is already at hand. */
export const extractWaveform = async (id: string, sourceFile?: string): Promise<WaveformMeta> => {
  if (!sourceFile) return withFootageFile(id, (file) => extractWaveform(id, file));
  try {
    const { stdout } = await execFileAsync(
      "ffmpeg",
      [
        "-i",
        sourceFile,
        "-vn",
        "-ac",
        "1",
        "-filter:a",
        `aresample=${WAVEFORM_RATE}`,
        "-map",
        "0:a:0",
        "-c:a",
        "pcm_s16le",
        "-f",
        "s16le",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 32 * 1024 * 1024, timeout: 90_000 },
    );
    const samples = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 2));
    if (samples.length === 0) return writeWaveform(id, { rate: WAVEFORM_RATE, hasAudio: false, peaks: [] });
    let max = 1;
    const raw = Array.from(samples, (sample) => {
      const value = Math.abs(sample);
      if (value > max) max = value;
      return value;
    });
    const peaks = raw.map((value) => Math.round((value / max) * 1000) / 1000);
    return writeWaveform(id, { rate: WAVEFORM_RATE, hasAudio: true, peaks });
  } catch (error) {
    if (isMissingFfmpeg(error)) throw error;
    return writeWaveform(id, { rate: WAVEFORM_RATE, hasAudio: false, peaks: [] });
  }
};
