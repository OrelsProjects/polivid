import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { clipDuration, clipResolution, generationModelBySlug } from "./models";
import type { VideoFormat } from "./schema";

const API = "https://openrouter.ai/api/v1";
const POLL_MS = 3000;
const POLL_LIMIT_MS = 4 * 60 * 1000;

const MEDIA_DIR = path.join(process.cwd(), "data", "media");

const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const footagePath = (id: string) => {
  if (!VIDEO_ID.test(id)) throw new Error("Invalid video id.");
  return path.join(MEDIA_DIR, `${id}.mp4`);
};

export const hasFootage = (id: string) => {
  if (!VIDEO_ID.test(id)) return false;
  return existsSync(footagePath(id));
};

export const saveFootage = async (id: string, bytes: Uint8Array) => {
  const file = footagePath(id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
};

export interface FootageRequest {
  prompt: string;
  format: VideoFormat;
  length: number;
  /** OpenRouter video-model slug. */
  model: string;
}

export interface FootageClip {
  durationSec: number;
  bytes: Uint8Array;
}

/**
 * Sends the prompt to an OpenRouter video model and returns the mp4 bytes.
 * Duration is snapped to a length the model accepts.
 */
export const renderFootage = async (input: FootageRequest): Promise<FootageClip> => {
  const model = generationModelBySlug(input.model);
  if (!model) {
    throw new Error("Pick Wan 3.0, MiniMax H3, Seedance 2.5, or FLUX 3. Those are the video models.");
  }
  if (!model.aspectRatios.includes(input.format)) {
    throw new Error(`${model.name} does not film ${input.format} video.`);
  }

  const duration = clipDuration(input.length, model.durations);
  const resolution = clipResolution(model.resolutions);
  const jobId = await submitJob({
    model: model.slug,
    prompt: input.prompt,
    duration,
    resolution,
    aspect_ratio: input.format,
    generate_audio: model.audio,
  });
  await waitForJob(jobId);
  const bytes = await downloadJob(jobId);
  return { durationSec: duration, bytes };
};

const apiKey = () => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
};

const submitJob = async (body: Record<string, unknown>) => {
  const response = await fetch(`${API}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const job = (await response.json()) as { id?: string };
  if (!job.id) throw new Error("The video model did not start a job.");
  return job.id;
};

const waitForJob = async (jobId: string) => {
  const started = Date.now();
  while (Date.now() - started < POLL_LIMIT_MS) {
    const response = await fetch(`${API}/videos/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    const job = (await response.json()) as { status?: string; error?: unknown };
    if (job.status === "completed") return;
    if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") {
      throw new Error(messageFrom(job.error) || `Video generation ${job.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("The video model took too long. Try again with a shorter clip.");
};

const downloadJob = async (jobId: string) => {
  const response = await fetch(`${API}/videos/${jobId}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) throw new Error(await errorMessage(response));
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1000) throw new Error("The video model returned an empty file.");
  return bytes;
};

const errorMessage = async (response: Response) => {
  const text = await response.text();
  return messageFrom(parseJson(text)) || text.slice(0, 300) || `Video request failed (${response.status}).`;
};

const parseJson = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const messageFrom = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as { message?: unknown; error?: unknown };
  return messageFrom(record.message) ?? messageFrom(record.error);
};
