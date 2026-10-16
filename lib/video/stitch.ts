import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SongWord } from "@/lib/music/song-plan";
import { extractLastFrame } from "@/lib/production/review/frames";
import { probeFile, type MediaProbe } from "@/lib/production/review/ffmpeg";
import { captionLines, captionPng } from "./lyric-captions";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 300_000;

/** Joins clips in order. Size and fps follow the first clip. Silent clips get silent audio. */
export const stitchClips = async (clips: Uint8Array[]) => {
  if (clips.length === 0) throw new Error("Nothing to stitch.");
  if (clips.length === 1) return clips[0]!;

  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-stitch-"));
  try {
    const files = await Promise.all(
      clips.map(async (bytes, index) => {
        const file = path.join(dir, `clip-${index}.mp4`);
        await writeFile(file, bytes);
        return file;
      }),
    );
    const probes = await Promise.all(files.map((file) => probeFile(file)));
    const output = path.join(dir, "stitched.mp4");
    await execFileAsync("ffmpeg", stitchArgs(files, probes, output), { timeout: TIMEOUT_MS });
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/**
 * Trims each silent clip to its slot, joins them, and lays one song underneath.
 * Lyric lines are burned from the song's word times when on-screen words are on.
 */
export const assembleSongVideo = async (input: {
  clips: Uint8Array[];
  durations: number[];
  song: Uint8Array;
  words: readonly SongWord[];
  showText: boolean;
  songStartSec?: number;
}) => {
  if (input.clips.length === 0) throw new Error("Nothing to stitch.");
  if (input.clips.length !== input.durations.length) throw new Error("Each clip needs a duration.");

  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-song-"));
  try {
    const files = await Promise.all(
      input.clips.map(async (bytes, index) => {
        const file = path.join(dir, `clip-${index}.mp4`);
        await writeFile(file, bytes);
        return file;
      }),
    );
    const songFile = path.join(dir, "song.mp3");
    await writeFile(songFile, input.song);
    const probes = await Promise.all(files.map((file) => probeFile(file)));
    const first = probes[0];
    if (!first?.hasVideo) throw new Error("The first clip has no video.");
    const width = first.width ?? 1280;
    const height = first.height ?? 720;
    const fps = first.fps && first.fps > 0 ? first.fps : 24;
    const fpsLabel = Number.isInteger(fps) ? String(fps) : fps.toFixed(3);
    const total = input.durations.reduce((sum, part) => sum + part, 0);
    const start = Math.max(0, input.songStartSec ?? 0);
    const lines = input.showText ? captionLines(input.words, start + total).filter((line) => line.endSec > start) : [];
    const captionFiles = await Promise.all(
      lines.map(async (line, index) => {
        const file = path.join(dir, `caption-${index}.png`);
        await writeFile(file, captionPng(line.text));
        return file;
      }),
    );

    const output = path.join(dir, "song-video.mp4");
    const args = ["-y"];
    for (const file of files) args.push("-i", file);
    args.push("-i", songFile);
    for (const file of captionFiles) args.push("-i", file);

    const filters: string[] = [];
    const videoLabels: string[] = [];
    files.forEach((_, index) => {
      const duration = Math.max(0.1, input.durations[index] ?? 0.1);
      filters.push(
        `[${index}:v]trim=duration=${duration.toFixed(3)},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fpsLabel},setsar=1,format=yuv420p[v${index}]`,
      );
      videoLabels.push(`[v${index}]`);
    });
    filters.push(`${videoLabels.join("")}concat=n=${files.length}:v=1:a=0[picture]`);
    let picture = "picture";
    const captionInput = files.length + 1;
    lines.forEach((line, index) => {
      const from = Math.max(0, line.startSec - start).toFixed(3);
      const to = Math.max(Number(from) + 0.2, line.endSec - start).toFixed(3);
      const next = `cap${index}`;
      filters.push(
        `[${picture}][${captionInput + index}:v]overlay=x=(W-w)/2:y=H-h-80:enable='between(t\\,${from}\\,${to})'[${next}]`,
      );
      picture = next;
    });
    filters.push(
      `[${files.length}:a]atrim=start=${start.toFixed(3)}:duration=${total.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[music]`,
    );
    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      `[${picture}]`,
      "-map",
      "[music]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      output,
    );
    await execFileAsync("ffmpeg", args, { timeout: TIMEOUT_MS });
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

export const sliceSong = async (song: Uint8Array, startSec: number, durationSec: number) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-slice-"));
  try {
    const source = path.join(dir, "song.mp3");
    const output = path.join(dir, "slice.wav");
    await writeFile(source, song);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        Math.max(0, startSec).toFixed(3),
        "-t",
        Math.max(0.1, durationSec).toFixed(3),
        "-i",
        source,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "44100",
        "-ac",
        "2",
        output,
      ],
      { timeout: 60_000 },
    );
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

export const lastFrameDataUrl = async (video: Uint8Array) => {
  const frame = await extractLastFrame(video);
  return `data:${frame.mime};base64,${Buffer.from(frame.bytes).toString("base64")}`;
};

const stitchArgs = (files: string[], probes: MediaProbe[], output: string) => {
  const first = probes[0];
  if (!first?.hasVideo) throw new Error("The first clip has no video.");
  const width = first.width ?? 1280;
  const height = first.height ?? 720;
  const fps = first.fps && first.fps > 0 ? first.fps : 24;
  const fpsLabel = Number.isInteger(fps) ? String(fps) : fps.toFixed(3);

  const args: string[] = ["-y"];
  for (const file of files) args.push("-i", file);

  const silentIndexes: number[] = [];
  for (const [index, probe] of probes.entries()) {
    if (probe.hasAudio) continue;
    args.push("-f", "lavfi", "-t", String(Math.max(probe.durationSec, 0.1)), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    silentIndexes.push(index);
  }

  const filters: string[] = [];
  const concatParts: string[] = [];
  for (const [index, probe] of probes.entries()) {
    filters.push(
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fpsLabel},setsar=1,format=yuv420p[v${index}]`,
    );
    const audioInput = probe.hasAudio ? index : files.length + silentIndexes.indexOf(index);
    filters.push(
      `[${audioInput}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,aresample=48000[a${index}]`,
    );
    concatParts.push(`[v${index}][a${index}]`);
  }

  args.push(
    "-filter_complex",
    `${filters.join(";")};${concatParts.join("")}concat=n=${files.length}:v=1:a=1[v][a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    output,
  );
  return args;
};
