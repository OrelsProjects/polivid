import "server-only";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { finishGeminiVideo, submitGeminiVideo } from "./gemini-footage";
import { assertVideoId, hasVideoMedia, isVideoId, putVideoMedia, readVideoMedia, videoMediaResponse } from "./media-store";
import { clipDuration, clipResolution, GENERATION_MODELS, generationModelBySlug, type VideoProvider } from "./models";
import { prepareFootageForSeeking } from "./prepare-footage";
import {
  checkVideoBytes,
  errorMessage,
  FootageStopped,
  isRetryableStatus,
  logMiss,
  messageFrom,
  ModelDeclined,
  sleep,
  stopIfCanceled,
} from "./provider-http";
import type { VideoFormat } from "./schema";

export { FootageStopped } from "./provider-http";

const API = "https://openrouter.ai/api/v1";

const footageKey = (id: string) => `${assertVideoId(id)}.mp4`;

export const hasFootage = async (id: string) => isVideoId(id) && hasVideoMedia(footageKey(id));

/** Streams the clip and honors Range. Null when the video has no clip. */
export const footageResponse = (id: string, rangeHeader: string | null, cacheControl?: string) =>
  videoMediaResponse(footageKey(id), "video/mp4", rangeHeader, cacheControl);

/** ffmpeg needs a path, so `work` gets a temporary copy that is removed afterwards. */
const withTempClip = async <T>(id: string, bytes: Uint8Array, work: (file: string) => Promise<T>) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-footage-"));
  try {
    const file = path.join(dir, `${id}.mp4`);
    await writeFile(file, bytes);
    return await work(file);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** Runs `work` on a local copy of the stored clip. */
export const withFootageFile = async <T>(id: string, work: (file: string) => Promise<T>) => {
  const bytes = await readVideoMedia(footageKey(id));
  if (!bytes) throw new Error("This video has no filmed clip.");
  return withTempClip(id, bytes, work);
};

export const saveFootage = async (id: string, bytes: Uint8Array) => {
  await withTempClip(assertVideoId(id), bytes, async (file) => {
    try {
      await prepareFootageForSeeking(file);
    } catch (error) {
      console.error("Could not prepare footage for seeking. The clip will still play.", error);
    }
    await putVideoMedia(footageKey(id), new Uint8Array(await readFile(file)), "video/mp4");
    try {
      const { extractScrubFrames } = await import("./scrub-frames");
      await extractScrubFrames(id, file);
    } catch (error) {
      console.error("Could not build scrub frames. Dragging the playhead may feel slow.", error);
    }
    try {
      const { extractWaveform } = await import("./waveform");
      await extractWaveform(id, file);
    } catch (error) {
      console.error("Could not build a waveform. The sound lane may stay empty.", error);
    }
  });
};

export interface FootageRequest {
  prompt: string;
  format: VideoFormat;
  length: number;
  /** Video-model slug from GENERATION_MODELS. */
  model: string;
  /** Preferred resolution. Falls back to the model's default when unsupported. */
  resolution?: string;
  /** Start-frame data URL for image-to-video. */
  imageDataUrl?: string;
  /** Audio or video references for models that accept them. */
  inputReferences?: Record<string, unknown>[];
  /** When set, overrides the model's own audio default. Lyrics clips stay silent. */
  generateAudio?: boolean;
}

export interface FootageClip {
  durationSec: number;
  bytes: Uint8Array;
}

const MODEL_NAMES = new Intl.ListFormat("en", { type: "disjunction" }).format(
  GENERATION_MODELS.map((model) => model.name),
);

/**
 * Sends the prompt to the model's provider (OpenRouter or Google) and returns the mp4 bytes.
 * Duration is snapped to a length the model accepts.
 * There is no time limit. A missing reply does not end the job.
 * The provider decides when the clip is done.
 * `onSubmitted` runs after the provider accepts the clip and before the wait,
 * so the id can be saved even if this process stops.
 * `shouldContinue` is checked between polls so a canceled job can stop waiting.
 * A database error inside that check does not cancel the wait.
 */
export const renderFootage = async (
  input: FootageRequest,
  shouldContinue: () => Promise<boolean> = async () => true,
  onSubmitted?: (providerJobId: string, provider: VideoProvider) => Promise<void>,
): Promise<FootageClip> => {
  const model = generationModelBySlug(input.model);
  if (!model) {
    throw new Error(`Pick ${MODEL_NAMES}. Those are the video models.`);
  }
  if (!model.aspectRatios.includes(input.format)) {
    throw new Error(`${model.name} does not film ${input.format} video.`);
  }

  const duration = clipDuration(input.length, model.durations);
  const resolution =
    input.resolution && model.resolutions.includes(input.resolution)
      ? input.resolution
      : clipResolution(model.resolutions);
  const providerJobId =
    model.provider === "google"
      ? await submitGeminiVideo({
          model: model.slug,
          prompt: input.prompt,
          duration,
          resolution,
          aspectRatio: input.format,
          imageDataUrl: input.imageDataUrl,
          inputReferences: input.inputReferences,
        })
      : await submitJob({
          model: model.slug,
          prompt: input.prompt,
          duration,
          resolution,
          aspect_ratio: input.format,
          generate_audio: input.generateAudio ?? model.audio,
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
      await onSubmitted(providerJobId, model.provider);
    } catch (error) {
      console.error("Could not save the video job id", error);
    }
  }
  const bytes = await finishFootage(providerJobId, model.provider, shouldContinue);
  return { durationSec: duration, bytes };
};

/** Keeps polling a video that was already submitted to `provider`. */
export const finishFootage = async (
  providerJobId: string,
  provider: VideoProvider,
  shouldContinue: () => Promise<boolean> = async () => true,
) => {
  if (provider === "google") return finishGeminiVideo(providerJobId, shouldContinue);
  await waitForJob(providerJobId, shouldContinue);
  return downloadJob(providerJobId);
};

const apiKey = () => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
};

export const submitOpenRouterVideoJob = async (body: Record<string, unknown>) =>
  submitJob(body);

export const downloadOpenRouterVideoJob = async (jobId: string) => downloadJob(jobId);

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
      if (isRetryableStatus(response.status)) throw new Error(`Video request failed (${response.status}).`);
      if (!response.ok) throw new ModelDeclined(await errorMessage(response));
      const job = (await response.json()) as { id?: string };
      if (!job.id) throw new Error("The video model did not start a job.");
      return job.id;
    } catch (error) {
      if (error instanceof ModelDeclined) throw error;
      misses += 1;
      logMiss(misses, "The video model has not accepted the clip yet. Still trying.", error);
      await sleep();
    }
  }
};

const waitForJob = async (jobId: string, shouldContinue: () => Promise<boolean>) => {
  let misses = 0;
  while (true) {
    await stopIfCanceled(shouldContinue);
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
      logMiss(misses, "The video model has not replied. Still waiting.", error);
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
      return checkVideoBytes(new Uint8Array(await response.arrayBuffer()));
    } catch (error) {
      if (error instanceof FootageStopped) throw error;
      misses += 1;
      logMiss(misses, "The video file is not back yet. Still waiting.", error);
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
