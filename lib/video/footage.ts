import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { clipDuration, clipResolution, generationModelBySlug } from "./models";
import type { VideoFormat } from "./schema";

const API = "https://openrouter.ai/api/v1";
const POLL_MS = 3000;

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
  /** Preferred resolution. Falls back to the model's default when unsupported. */
  resolution?: string;
  /** Start-frame data URL for image-to-video. */
  imageDataUrl?: string;
  /** Audio or video references for models that accept them. */
  inputReferences?: Record<string, unknown>[];
}

export interface FootageClip {
  durationSec: number;
  bytes: Uint8Array;
}

export class FootageStopped extends Error {
  constructor() {
    super("Stopped.");
    this.name = "FootageStopped";
  }
}

/**
 * Sends the prompt to an OpenRouter video model and returns the mp4 bytes.
 * Duration is snapped to a length the model accepts.
 * There is no time limit. A missing reply does not end the job.
 * OpenRouter decides when the clip is done.
 * `onSubmitted` runs after OpenRouter accepts the clip and before the wait,
 * so the id can be saved even if this process stops.
 * `shouldContinue` is checked between polls so a canceled job can stop waiting.
 * A database error inside that check does not cancel the OpenRouter wait.
 */
export const renderFootage = async (
  input: FootageRequest,
  shouldContinue: () => Promise<boolean> = async () => true,
  onSubmitted?: (providerJobId: string) => Promise<void>,
): Promise<FootageClip> => {
  const model = generationModelBySlug(input.model);
  if (!model) {
    throw new Error("Pick Wan 3.0, MiniMax H3, Seedance 2.5, or FLUX 3. Those are the video models.");
  }
  if (!model.aspectRatios.includes(input.format)) {
    throw new Error(`${model.name} does not film ${input.format} video.`);
  }

  const duration = clipDuration(input.length, model.durations);
  const resolution =
    input.resolution && model.resolutions.includes(input.resolution)
      ? input.resolution
      : clipResolution(model.resolutions);
  const providerJobId = await submitJob({
    model: model.slug,
    prompt: input.prompt,
    duration,
    resolution,
    aspect_ratio: input.format,
    generate_audio: model.audio,
    ...(input.imageDataUrl
      ? {
          frame_images: [
            {
              type: "image_url",
              image_url: { url: input.imageDataUrl },
              frame_type: "first_frame",
            },
          ],
        }
      : {}),
    ...(input.inputReferences?.length ? { input_references: input.inputReferences } : {}),
  });
  if (onSubmitted) {
    try {
      await onSubmitted(providerJobId);
    } catch (error) {
      console.error("Could not save the OpenRouter video id", error);
    }
  }
  const bytes = await finishFootage(providerJobId, shouldContinue);
  return { durationSec: duration, bytes };
};

/** Keeps polling an OpenRouter video that was already submitted. */
export const finishFootage = async (providerJobId: string, shouldContinue: () => Promise<boolean> = async () => true) => {
  await waitForJob(providerJobId, shouldContinue);
  return downloadJob(providerJobId);
};

const apiKey = () => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
};

/** The model answered that this clip will not be made. Silence is not this. */
class ModelDeclined extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelDeclined";
  }
}

const sleep = () => new Promise((resolve) => setTimeout(resolve, POLL_MS));

const submitJob = async (body: Record<string, unknown>) => {
  let misses = 0;
  while (true) {
    try {
      const response = await fetch(`${API}/videos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        throw new Error(`Video request failed (${response.status}).`);
      }
      if (!response.ok) throw new ModelDeclined(await errorMessage(response));
      const job = (await response.json()) as { id?: string };
      if (!job.id) throw new Error("The video model did not start a job.");
      return job.id;
    } catch (error) {
      if (error instanceof ModelDeclined) throw error;
      misses += 1;
      if (misses === 1 || misses % 10 === 0) {
        console.error("The video model has not accepted the clip yet. Still trying.", causeText(error));
      }
      await sleep();
    }
  }
};

const waitForJob = async (jobId: string, shouldContinue: () => Promise<boolean>) => {
  let misses = 0;
  while (true) {
    try {
      if (!(await shouldContinue())) throw new FootageStopped();
    } catch (error) {
      if (error instanceof FootageStopped) throw error;
    }
    try {
      const response = await fetch(`${API}/videos/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey()}` },
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const job = (await response.json()) as { status?: string; error?: unknown };
      if (job.status === "completed") return;
      if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") {
        throw new ModelDeclined(messageFrom(job.error) || `Video generation ${job.status}.`);
      }
      misses = 0;
    } catch (error) {
      if (error instanceof ModelDeclined || error instanceof FootageStopped) throw error;
      misses += 1;
      if (misses === 1 || misses % 10 === 0) {
        console.error("The video model has not replied. Still waiting.", causeText(error));
      }
    }
    await sleep();
  }
};

const downloadJob = async (jobId: string) => {
  let misses = 0;
  while (true) {
    try {
      const response = await fetch(`${API}/videos/${jobId}/content`, {
        headers: { Authorization: `Bearer ${apiKey()}` },
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("application/json")) throw new Error(await errorMessage(response));
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 1000) throw new Error("The video model returned an empty file.");
      return bytes;
    } catch (error) {
      if (error instanceof FootageStopped) throw error;
      misses += 1;
      if (misses === 1 || misses % 10 === 0) {
        console.error("The video file is not back yet. Still waiting.", causeText(error));
      }
      await sleep();
    }
  }
};

/** A dropped connection, written for the video page. Model errors keep their own text. */
export const footageErrorMessage = (error: unknown) => {
  if (error instanceof TypeError && (error.message === "fetch failed" || error.message === "terminated")) {
    return "Couldn't reach the video model. Try again.";
  }
  return error instanceof Error ? error.message : "The video didn't finish.";
};

const causeText = (error: unknown) => {
  if (!(error instanceof Error)) return "No reply";
  const cause = error.cause;
  return cause instanceof Error && cause.message ? cause.message : error.message;
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
