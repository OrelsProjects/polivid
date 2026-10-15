import { capabilityById } from "../capabilities";
import { playablePlaceholderMp4, toneWav } from "../placeholder-media";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const jobs = new Map<string, AdapterJob>();
const submittedKeys = new Map<string, string>();

export const resetMockAdapters = () => {
  jobs.clear();
  submittedKeys.clear();
};

const pngBytes = () =>
  Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
    (char) => char.charCodeAt(0),
  );

const mp4Placeholder = (label: string) =>
  Uint8Array.from({ length: 1200 }, (_, i) => (label.charCodeAt(i % Math.max(1, label.length)) + i) % 256);

const complete = (id: string, request: AdapterRequest, mime: string, bytes: Uint8Array, extra: Partial<AdapterJob> = {}): AdapterJob => {
  const capability = capabilityById(
    request.modelId.includes("omni")
      ? "video-omni"
      : request.modelId.includes("wan")
        ? "video-wan"
        : request.modelId.includes("sync")
          ? "lipsync-sync-3"
          : request.modelId.includes("music")
            ? "music-v2-5"
            : request.modelId.includes("scribe")
              ? "scribe-v2"
              : request.modelId.includes("eleven_v4")
                ? "speech-eleven-v4"
                : request.modelId.includes("sound")
                  ? "sfx-eleven"
                  : request.modelId.includes("image")
                    ? "image-flare"
                    : "review-flash",
  );
  const job: AdapterJob = {
    providerJobId: id,
    status: "completed",
    outputs: [{ mime, bytes }],
    usage: { usd: capability?.pricing.usd ?? 0.01, units: { count: 1 } },
    extensionSpan: capability?.extension === "returns_full" ? "full" : capability?.extension === "returns_new_only" ? "new_only" : undefined,
    ...extra,
  };
  jobs.set(id, job);
  return job;
};

export const createMockAdapter = (id: string): MediaAdapter => ({
  id,
  estimate: (request) => {
    if (request.durationSec) return request.durationSec * 0.1;
    return 0.05;
  },
  submit: async (request, idempotencyKey) => {
    const existing = submittedKeys.get(idempotencyKey);
    if (existing) return jobs.get(existing) ?? { providerJobId: existing, status: "in_progress", outputs: [], usage: { usd: 0, units: {} } };
    const providerJobId = `mock_${id}_${crypto.randomUUID()}`;
    submittedKeys.set(idempotencyKey, providerJobId);
    jobs.set(providerJobId, { providerJobId, status: "in_progress", outputs: [], usage: { usd: 0, units: {} } });

    if (id === "video") {
      const span = request.interactionContext ? "full" : undefined;
      const bytes = await playablePlaceholderMp4().catch(() => mp4Placeholder(request.prompt));
      return complete(providerJobId, request, "video/mp4", bytes, {
        interactionContext: { turn: 1, prompt: request.prompt },
        extensionSpan: span ?? (request.modelId.includes("omni") ? "full" : "new_only"),
      });
    }
    if (id === "image") return complete(providerJobId, request, "image/png", pngBytes());
    if (id === "speech" || id === "music" || id === "sfx") {
      const freq = id === "speech" ? 220 : id === "music" ? 330 : 880;
      const bytes = toneWav(request.durationSec ?? 3, freq);
      return complete(providerJobId, request, "audio/wav", bytes, {
        outputs: [
          {
            mime: "audio/wav",
            bytes,
            json: { durationSec: request.durationSec ?? 3 },
          },
        ],
      });
    }
    if (id === "lipsync") {
      if (!request.syncMode) {
        return {
          providerJobId,
          status: "failed",
          outputs: [],
          usage: { usd: 0, units: {} },
          error: "sync_mode is required so footage is not looped, reversed, sped up, or truncated.",
        };
      }
      const bytes = await playablePlaceholderMp4().catch(() => mp4Placeholder("lipsync"));
      return complete(providerJobId, request, "video/mp4", bytes);
    }
    if (id === "transcribe") {
      return complete(providerJobId, request, "application/json", new Uint8Array(), {
        outputs: [
          {
            mime: "application/json",
            json: {
              text: request.text ?? "I can't keep doing this.",
              words: [{ word: "I", start: 0, end: 0.2, confidence: 0.99 }],
              confidence: 0.94,
            },
          },
        ],
      });
    }
    if (id === "review") {
      return complete(providerJobId, request, "application/json", new Uint8Array(), {
        outputs: [
          {
            mime: "application/json",
            json: {
              passed: true,
              findings: [],
              observation: {
                completedActions: ["reached for the door"],
                incompleteActions: [],
                deviations: [],
                boundaryOut: {
                  position: "at the door",
                  direction: "facing the door",
                  speed: "still",
                  gaze: "on the knob",
                  camera: "over-shoulder",
                  props: ["letter"],
                  incompleteAction: null,
                },
              },
            },
          },
        ],
      });
    }
    return complete(providerJobId, request, "application/octet-stream", new Uint8Array(8));
  },
  poll: async (providerJobId) => jobs.get(providerJobId) ?? { providerJobId, status: "failed", outputs: [], usage: { usd: 0, units: {} }, error: "Unknown job." },
  collect: async (providerJobId) => jobs.get(providerJobId) ?? { providerJobId, status: "failed", outputs: [], usage: { usd: 0, units: {} }, error: "Unknown job." },
});

export const mockAdapterSet = () => ({
  image: createMockAdapter("image"),
  video: createMockAdapter("video"),
  speech: createMockAdapter("speech"),
  music: createMockAdapter("music"),
  sfx: createMockAdapter("sfx"),
  lipsync: createMockAdapter("lipsync"),
  review: createMockAdapter("review"),
  transcribe: createMockAdapter("transcribe"),
});
