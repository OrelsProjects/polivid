import "server-only";
import { geminiApiKey } from "@/lib/ai/gemini";
import {
  checkVideoBytes,
  errorMessage,
  isRetryableStatus,
  logMiss,
  messageFrom,
  ModelDeclined,
  sleep,
  stopIfCanceled,
} from "./provider-http";

const API = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiVideoRequest {
  /** Stored slug, e.g. google/gemini-omni-1.1-flash. */
  model: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  /** Start-frame data URL for image-to-video. */
  imageDataUrl?: string;
  /** OpenRouter-shaped references. Gemini Omni only takes pictures. */
  inputReferences?: Record<string, unknown>[];
}

interface InteractionContent {
  type?: string;
  text?: string;
  data?: string;
  uri?: string;
}

interface Interaction {
  id?: string;
  status?: string;
  error?: unknown;
  steps?: { type?: string; content?: InteractionContent[] }[];
}

const UNFINISHED = new Set(["in_progress", "queued"]);

const headers = () => ({ "x-goog-api-key": geminiApiKey() });

/** Starts a background interaction and returns its id. Retries until Google answers. */
export const submitGeminiVideo = async (request: GeminiVideoRequest) => {
  const body = {
    model: request.model.replace(/^google\//, ""),
    input: geminiInput(request),
    background: true,
    response_format: {
      type: "video",
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution,
      duration: `${request.duration}s`,
    },
    ...(request.imageDataUrl ? { generation_config: { video_config: { task: "image_to_video" } } } : {}),
  };
  let misses = 0;
  while (true) {
    try {
      const response = await fetch(`${API}/interactions`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (isRetryableStatus(response.status)) throw new Error(`Video request failed (${response.status}).`);
      if (!response.ok) throw new ModelDeclined(await errorMessage(response));
      const interaction = (await response.json()) as Interaction;
      if (!interaction.id) throw new Error("Gemini Omni did not start a job.");
      return interaction.id;
    } catch (error) {
      if (error instanceof ModelDeclined) throw error;
      misses += 1;
      logMiss(misses, "Gemini Omni has not accepted the clip yet. Still trying.", error);
      await sleep();
    }
  }
};

/** Polls a submitted interaction until it ends, then returns the mp4 bytes. */
export const finishGeminiVideo = async (interactionId: string, shouldContinue: () => Promise<boolean>) => {
  let misses = 0;
  while (true) {
    await stopIfCanceled(shouldContinue);
    try {
      const response = await fetch(`${API}/interactions/${encodeURIComponent(interactionId)}`, {
        headers: headers(),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const interaction = (await response.json()) as Interaction;
      const status = interaction.status ?? "";
      if (status === "completed") return await videoFrom(interaction);
      if (!UNFINISHED.has(status)) {
        throw new ModelDeclined(messageFrom(interaction.error) || `Video generation ${status || "stopped"}.`);
      }
      misses = 0;
    } catch (error) {
      if (error instanceof ModelDeclined) throw error;
      misses += 1;
      logMiss(misses, "Gemini Omni has not replied. Still waiting.", error);
    }
    await sleep();
  }
};

const geminiInput = (request: GeminiVideoRequest) => {
  const images = [
    ...(request.imageDataUrl ? [request.imageDataUrl] : []),
    ...(request.inputReferences ?? []).map(referenceImageUrl),
  ];
  if (images.length === 0) return request.prompt;
  return [...images.map(imageContent), { type: "text", text: request.prompt }];
};

const referenceImageUrl = (reference: Record<string, unknown>) => {
  const imageUrl = reference.image_url as { url?: unknown } | undefined;
  if (reference.type !== "image_url" || typeof imageUrl?.url !== "string") {
    throw new ModelDeclined("Gemini Omni only takes reference pictures, not audio or video.");
  }
  return imageUrl.url;
};

const imageContent = (dataUrl: string) => {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new ModelDeclined("Gemini Omni could not read that picture.");
  return { type: "image", mime_type: match[1], data: match[2] };
};

/** The video is inline base64 when polled. A URI is only expected on the first reply, but is handled. */
const videoFrom = async (interaction: Interaction) => {
  const output = (interaction.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? []);
  const video = output.find((content) => content.type === "video");
  if (video?.data) return checkVideoBytes(new Uint8Array(Buffer.from(video.data, "base64")));
  if (video?.uri) return downloadUri(video.uri);
  const said = output
    .filter((content) => content.type === "text" && content.text)
    .map((content) => content.text)
    .join(" ")
    .trim();
  throw new ModelDeclined(said || "Gemini Omni finished without a video.");
};

const downloadUri = async (uri: string) => {
  const response = await fetch(uri, { headers: headers() });
  if (!response.ok) throw new Error(await errorMessage(response));
  return checkVideoBytes(new Uint8Array(await response.arrayBuffer()));
};
