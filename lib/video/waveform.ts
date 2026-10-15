import "server-only";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { footagePath } from "./footage";

const execFileAsync = promisify(execFile);

export const WAVEFORM_RATE = 80;

const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_DIR = path.join(process.cwd(), "data", "media");

export interface WaveformMeta {
  rate: number;
  hasAudio: boolean;
  peaks: number[];
}

export const waveformPath = (id: string) => {
  if (!VIDEO_ID.test(id)) throw new Error("Invalid video id.");
  return path.join(MEDIA_DIR, "waveform", `${id}.json`);
};

export const readWaveform = async (id: string): Promise<WaveformMeta | null> => {
  const file = waveformPath(id);
  if (!existsSync(file)) return null;
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(file, "utf8")) as WaveformMeta;
};

const writeWaveform = async (id: string, meta: WaveformMeta) => {
  const file = waveformPath(id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(meta));
  return meta;
};

export const extractWaveform = async (id: string) => {
  const source = footagePath(id);
  if (!existsSync(source)) throw new Error("This video has no filmed clip.");
  try {
    const { stdout } = await execFileAsync(
      "ffmpeg",
      [
        "-i",
        source,
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
  } catch {
    return writeWaveform(id, { rate: WAVEFORM_RATE, hasAudio: false, peaks: [] });
  }
};
