import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { unzipSync } from "fflate";

const BASE = "https://api.elevenlabs.io";
const execFileAsync = promisify(execFile);

const key = () => {
  const value = process.env.ELEVENLABS_API_KEY?.trim();
  if (!value) throw new Error("ELEVENLABS_API_KEY is not set.");
  return value;
};

const failure = async (response: Response, what: string) => {
  const detail = await response.text().catch(() => "");
  if (response.status === 402 || /paid_plan_required/i.test(detail)) return new Error(`${what} needs a paid ElevenLabs plan.`);
  return new Error(`${what} failed (${response.status}). ${detail.slice(0, 160)}`);
};

export interface SongStems {
  vocal: Uint8Array;
  backing: Uint8Array[];
}

/** Splits a song into its vocal and everything else. */
export const separateVocal = async (song: Uint8Array): Promise<SongStems> => {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(song)], { type: "audio/mpeg" }), "song.mp3");
  const response = await fetch(`${BASE}/v1/music/stem-separation?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key() },
    body: form,
  });
  if (!response.ok) throw await failure(response, "Splitting the vocal");
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const entries = Object.entries(files).filter(([name, bytes]) => bytes.byteLength > 0 && !name.endsWith("/"));
  const vocalEntry = entries.find(([name]) => /vocal|voice/i.test(path.basename(name)));
  if (!vocalEntry) throw new Error("ElevenLabs did not return a vocal stem.");
  return {
    vocal: vocalEntry[1],
    backing: entries.filter(([name]) => name !== vocalEntry[0]).map(([, bytes]) => bytes),
  };
};

/** Re-sings a vocal in a saved voice. Melody and timing stay; the voice changes. */
export const changeVoice = async (vocal: Uint8Array, voiceId: string) => {
  const form = new FormData();
  form.append("audio", new Blob([Buffer.from(vocal)], { type: "audio/mpeg" }), "vocal.mp3");
  form.append("model_id", "eleven_multilingual_sts_v2");
  form.append("remove_background_noise", "false");
  const response = await fetch(
    `${BASE}/v1/speech-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    { method: "POST", headers: { "xi-api-key": key() }, body: form },
  );
  if (!response.ok) throw await failure(response, "Changing the voice");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("ElevenLabs returned no voice.");
  return bytes;
};

/** Mean loudness in dB, from ffmpeg's volumedetect. */
const meanVolumeDb = async (audio: Uint8Array) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-level-"));
  try {
    const file = path.join(dir, "audio.mp3");
    await writeFile(file, audio);
    const { stderr } = await execFileAsync("ffmpeg", ["-hide_banner", "-i", file, "-af", "volumedetect", "-vn", "-f", "null", "-"], {
      timeout: 60_000,
    });
    const match = /mean_volume:\s*(-?[0-9.]+) dB/.exec(stderr);
    return match ? Number(match[1]) : null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** Lays one vocal over the backing stems. `vocalGainDb` sets the vocal level against the music. */
export const mixVocal = async (vocal: Uint8Array, backing: Uint8Array[], vocalGainDb = 0) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-mix-"));
  try {
    const files = [vocal, ...backing];
    const paths = await Promise.all(
      files.map(async (bytes, index) => {
        const file = path.join(dir, `stem-${index}.mp3`);
        await writeFile(file, bytes);
        return file;
      }),
    );
    const output = path.join(dir, "mix.mp3");
    const args = ["-y"];
    for (const file of paths) args.push("-i", file);
    const backingInputs = paths.slice(1).map((_, index) => `[${index + 1}:a]`).join("");
    args.push(
      "-filter_complex",
      `[0:a]volume=${vocalGainDb.toFixed(2)}dB[voice];[voice]${backingInputs}amix=inputs=${paths.length}:duration=longest:normalize=0,alimiter=limit=0.95[out]`,
      "-map",
      "[out]",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      output,
    );
    await execFileAsync("ffmpeg", args, { timeout: 120_000 });
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** The song with its vocal re-sung by `voiceId`, plus the pieces for listening side by side. */
export const singAs = async (song: Uint8Array, voiceId: string) => {
  const stems = await separateVocal(song);
  const sung = await changeVoice(stems.vocal, voiceId);
  const [original, changed] = await Promise.all([meanVolumeDb(stems.vocal), meanVolumeDb(sung)]);
  const gain = original !== null && changed !== null ? Math.max(-24, Math.min(12, original - changed)) : 0;
  const mix = await mixVocal(sung, stems.backing, gain);
  return { vocal: stems.vocal, sung, mix };
};
