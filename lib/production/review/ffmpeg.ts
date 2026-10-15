import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface MediaProbe {
  durationSec: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
  codec: string | null;
}

export interface MediaCheck {
  ok: boolean;
  probe: MediaProbe | null;
  issues: string[];
}

const parseProbe = (raw: string): MediaProbe => {
  const json = JSON.parse(raw) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string }[];
  };
  const video = json.streams?.find((stream) => stream.codec_type === "video");
  const audio = json.streams?.find((stream) => stream.codec_type === "audio");
  const [num, den] = (video?.avg_frame_rate ?? "0/1").split("/").map(Number);
  return {
    durationSec: Number(json.format?.duration ?? 0),
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: den ? num / den : null,
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
    codec: video?.codec_name ?? audio?.codec_name ?? null,
  };
};

export const probeFile = async (filePath: string): Promise<MediaProbe> => {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  return parseProbe(stdout);
};

export const checkMediaFile = async (filePath: string, expected?: { durationSec?: number; hasVideo?: boolean }): Promise<MediaCheck> => {
  const issues: string[] = [];
  try {
    const probe = await probeFile(filePath);
    if (expected?.hasVideo && !probe.hasVideo) issues.push("The file has no video stream.");
    if (expected?.durationSec && Math.abs(probe.durationSec - expected.durationSec) > 0.5) {
      issues.push(`Duration is ${probe.durationSec.toFixed(2)}s, expected about ${expected.durationSec.toFixed(2)}s.`);
    }
    if (probe.durationSec <= 0) issues.push("Duration is missing.");
    return { ok: issues.length === 0, probe, issues };
  } catch (error) {
    return { ok: false, probe: null, issues: [error instanceof Error ? error.message : "ffprobe failed."] };
  }
};

export const extractBoundaryFrames = async (filePath: string, outputPattern: string) => {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    filePath,
    "-vf",
    "select='lt(t,0.2)+gt(t,0.2)*lt(n,3)',showinfo",
    "-vsync",
    "vfr",
    outputPattern,
  ]);
};

export const detectFreeze = async (filePath: string) => {
  const { stderr } = await execFileAsync("ffmpeg", ["-i", filePath, "-vf", "freezedetect=n=0.003:d=0.5", "-f", "null", "-"]);
  return /freeze_start/.test(stderr);
};

export const detectSilence = async (filePath: string) => {
  const { stderr } = await execFileAsync("ffmpeg", ["-i", filePath, "-af", "silencedetect=n=-40dB:d=0.5", "-f", "null", "-"]);
  return /silence_start/.test(stderr);
};

export const measureLoudness = async (filePath: string) => {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-i",
    filePath,
    "-af",
    "loudnorm=print_format=summary",
    "-f",
    "null",
    "-",
  ]);
  const integrated = stderr.match(/Input Integrated:\s+([-\d.]+)/)?.[1];
  const truePeak = stderr.match(/Input True Peak:\s+([-\d.]+)/)?.[1];
  return {
    integratedLuFs: integrated ? Number(integrated) : null,
    truePeakDb: truePeak ? Number(truePeak) : null,
    clips: truePeak ? Number(truePeak) > -1 : false,
  };
};

export const timelineDuration = (clips: { startSec: number; durationSec: number }[]) =>
  clips.reduce((end, clip) => Math.max(end, clip.startSec + clip.durationSec), 0);
