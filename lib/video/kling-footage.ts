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
import {
  isKlingOutOfCredit,
  KLING_API,
  KLING_UNAVAILABLE,
  klingTaskFailure,
  klingCall,
  klingSwapCall,
  klingSwapEditCall,
  type KlingCall,
  type KlingSwapEditRequest,
  type KlingSwapRequest,
  type KlingVideoRequest,
} from "./kling-request";

export type { KlingSwapEditRequest, KlingSwapRequest, KlingVideoRequest };

export const hasKlingKey = () => Boolean(process.env.KLING_API_KEY?.trim());

const apiKey = () => {
  const key = process.env.KLING_API_KEY?.trim();
  if (!key) throw new Error("KLING_API_KEY is not set");
  return key;
};

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

const declined = async (response: Response) => {
  const message = await errorMessage(response);
  if (isKlingOutOfCredit(message)) {
    console.error("The Kling account can't pay for new videos. Top it up in the Kling developer console.", message);
    return new ModelDeclined(KLING_UNAVAILABLE);
  }
  if (!isRetryableStatus(response.status)) return new ModelDeclined(message);
  return new Error(message);
};

const readEnvelope = async (response: Response) => {
  if (!response.ok) throw await declined(response);
  const body = (await response.json()) as KlingEnvelope;
  if (typeof body.code === "number" && body.code !== 0) {
    const message = body.message?.trim() || "Kling declined that clip.";
    if (isKlingOutOfCredit(message)) {
      console.error("The Kling account can't pay for new videos. Top it up in the Kling developer console.", message);
      throw new ModelDeclined(KLING_UNAVAILABLE);
    }
    throw new ModelDeclined(message);
  }
  return body;
};

const tasksFrom = (body: KlingEnvelope) => {
  if (Array.isArray(body.data)) return body.data;
  if (body.data && typeof body.data === "object") return [body.data];
  return [];
};

/** Starts a Kling clip and returns the task id. Retries until Kling answers. */
export const submitKlingVideo = (request: KlingVideoRequest) => submitKlingCall(klingCall(request));

/** Starts a Motion Control character swap and returns the task id. */
export const submitKlingSwap = (request: KlingSwapRequest) => submitKlingCall(klingSwapCall(request));

/** Starts a Kling 3.0 Omni edit that replaces a subject in the video, and returns the task id. */
export const submitKlingSwapEdit = (request: KlingSwapEditRequest) => submitKlingCall(klingSwapEditCall(request));

const submitKlingCall = async (call: KlingCall) => {
  let misses = 0;
  while (true) {
    try {
      const response = await fetch(call.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(call.body),
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
      const response = await fetch(`${KLING_API}/tasks?task_ids=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey()}` },
      });
      const envelope = await readEnvelope(response);
      const task = tasksFrom(envelope).find((item) => item.id === taskId) ?? tasksFrom(envelope)[0];
      const status = task?.status ?? "";
      if (status === "succeeded") return downloadVideo(task);
      if (status && !UNFINISHED.has(status)) {
        const failure = klingTaskFailure(task?.message, status);
        if (failure.outOfCredit) {
          console.error("The Kling account can't pay for new videos. Top it up in the Kling developer console.", failure.detail);
        }
        throw new ModelDeclined(failure.message);
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
