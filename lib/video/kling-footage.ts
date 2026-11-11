import "server-only";
import {
  checkVideoBytes,
  errorMessage,
  isRetryableStatus,
  logMiss,
  ModelDeclined,
  sleep,
  stopIfCanceled,
} from "./provider-http";

const API = "https://api-singapore.klingai.com";

export const hasKlingKey = () => Boolean(process.env.KLING_API_KEY?.trim());

const apiKey = () => {
  const key = process.env.KLING_API_KEY?.trim();
  if (!key) throw new Error("KLING_API_KEY is not set");
  return key;
};

interface KlingRoute {
  /** Path segment, such as kling-3.0. */
  path: string;
  /** Omni takes several reference pictures. The others take one start frame. */
  omni?: boolean;
  /** Send settings.audio. Kling 2.6 native audio is 1080p only. */
  audio?: boolean;
  audioResolution?: string;
  /** Kling 3.0 can split a prompt into shots. A single beat stays one shot. */
  multiShot?: boolean;
}

const ROUTES: Record<string, KlingRoute> = {
  "kling-3.0": { path: "kling-3.0", audio: true, multiShot: true },
  "kling-3.0-turbo": { path: "kling-3.0-turbo" },
  "kling-3.0-omni": { path: "kling-3.0-omni", omni: true, audio: true, multiShot: true },
  "kling-2.6": { path: "kling-2.6", audio: true, audioResolution: "1080p" },
  "kling-2.5-turbo": { path: "kling-2.5-turbo" },
};

export interface KlingVideoRequest {
  /** Stored slug, such as kling-3.0. */
  model: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  generateAudio: boolean;
  imageDataUrl?: string;
  inputReferences?: Record<string, unknown>[];
}

interface KlingTask {
  id?: string;
  status?: string;
  message?: string;
  outputs?: { type?: string; url?: string; watermark_url?: string }[];
}

interface KlingEnvelope {
  code?: number;
  message?: string;
  data?: KlingTask | KlingTask[];
}

const UNFINISHED = new Set(["submitted", "processing"]);

const routeFor = (slug: string) => {
  const route = ROUTES[slug];
  if (!route) throw new Error(`${slug} is not a Kling model.`);
  return route;
};

const imageUrl = (reference: Record<string, unknown>) => {
  const image = reference.image_url as { url?: unknown } | undefined;
  return reference.type === "image_url" && typeof image?.url === "string" ? image.url : "";
};

const pictures = (request: KlingVideoRequest) => {
  const urls = [
    request.imageDataUrl ?? "",
    ...(request.inputReferences ?? []).map(imageUrl),
  ].filter(Boolean);
  return [...new Set(urls)].slice(0, 7);
};

const settingsFor = (route: KlingRoute, request: KlingVideoRequest) => {
  const audioOn = route.audio === true && request.generateAudio;
  const resolution = audioOn && route.audioResolution ? route.audioResolution : request.resolution;
  const settings: Record<string, unknown> = {
    resolution,
    aspect_ratio: request.aspectRatio,
    duration: request.duration,
  };
  if (route.audio) settings.audio = audioOn ? "native" : "off";
  if (route.multiShot) settings.multi_shot = false;
  return settings;
};

const contentsFor = (route: KlingRoute, request: KlingVideoRequest, images: string[]) => {
  const prompt = { type: "prompt", text: request.prompt.slice(0, 3000) };
  if (route.omni) {
    const [first, ...rest] = images;
    return [
      prompt,
      ...(first ? [{ type: "first_frame", url: first }] : []),
      ...rest.map((url) => ({ type: "refer_image", url })),
    ];
  }
  const frame = images[0];
  if (!frame) return null;
  return [prompt, { type: "first_frame", url: frame }];
};

const endpointFor = (route: KlingRoute, hasFrame: boolean) => {
  if (route.omni) return `${API}/omni-video/${route.path}`;
  if (hasFrame) return `${API}/image-to-video/${route.path}`;
  return `${API}/text-to-video/${route.path}`;
};

const declined = async (response: Response) => {
  const message = await errorMessage(response);
  if (!isRetryableStatus(response.status)) return new ModelDeclined(message);
  return new Error(message);
};

const readEnvelope = async (response: Response) => {
  if (!response.ok) throw await declined(response);
  const body = (await response.json()) as KlingEnvelope;
  if (typeof body.code === "number" && body.code !== 0) {
    throw new ModelDeclined(body.message?.trim() || "Kling declined that clip.");
  }
  return body;
};

const tasksFrom = (body: KlingEnvelope) => {
  if (Array.isArray(body.data)) return body.data;
  if (body.data && typeof body.data === "object") return [body.data];
  return [];
};

/** Starts a Kling clip and returns the task id. Retries until Kling answers. */
export const submitKlingVideo = async (request: KlingVideoRequest) => {
  const route = routeFor(request.model);
  const images = pictures(request);
  const contents = contentsFor(route, request, images);
  const body = {
    ...(contents ? { contents } : { prompt: request.prompt.slice(0, 3000) }),
    settings: settingsFor(route, request),
    options: { watermark_info: { enabled: false } },
  };
  let misses = 0;
  while (true) {
    try {
      const response = await fetch(endpointFor(route, Boolean(contents)), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const envelope = await readEnvelope(response);
      const id = tasksFrom(envelope)[0]?.id;
      if (!id) throw new Error("Kling did not start a job.");
      return id;
    } catch (error) {
      if (error instanceof ModelDeclined) throw error;
      misses += 1;
      logMiss(misses, "Kling has not accepted the clip yet. Still trying.", error);
      await sleep();
    }
  }
};

/** Polls a Kling task until it ends, then returns the mp4 bytes. */
export const finishKlingVideo = async (taskId: string, shouldContinue: () => Promise<boolean>) => {
  let misses = 0;
  while (true) {
    await stopIfCanceled(shouldContinue);
    try {
      const response = await fetch(`${API}/tasks?task_ids=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey()}` },
      });
      const envelope = await readEnvelope(response);
      const task = tasksFrom(envelope).find((item) => item.id === taskId) ?? tasksFrom(envelope)[0];
      const status = task?.status ?? "";
      if (status === "succeeded") return downloadVideo(task);
      if (status && !UNFINISHED.has(status)) {
        throw new ModelDeclined(task?.message?.trim() || `Kling ${status}.`);
      }
      misses = 0;
    } catch (error) {
      if (error instanceof ModelDeclined) throw error;
      misses += 1;
      logMiss(misses, "Kling has not replied. Still waiting.", error);
    }
    await sleep();
  }
};

const downloadVideo = async (task: KlingTask | undefined) => {
  const video = task?.outputs?.find((output) => output.type === "video" && (output.url || output.watermark_url));
  const url = video?.url || video?.watermark_url;
  if (!url) throw new ModelDeclined(task?.message?.trim() || "Kling finished without a video.");
  const response = await fetch(url);
  if (!response.ok) throw new Error(await errorMessage(response));
  return checkVideoBytes(new Uint8Array(await response.arrayBuffer()));
};
