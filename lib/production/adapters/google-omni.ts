import { finishGeminiVideo, submitGeminiVideo } from "@/lib/video/gemini-footage";
import { capabilityById } from "../capabilities";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const API = "https://generativelanguage.googleapis.com/v1beta";

const key = () => {
  const value = process.env.GEMINI_API_KEY?.trim();
  if (!value) throw new Error("GEMINI_API_KEY is not set.");
  return value;
};

const toJob = (id: string, status: AdapterJob["status"], extra: Partial<AdapterJob> = {}): AdapterJob => ({
  providerJobId: id,
  status,
  outputs: extra.outputs ?? [],
  usage: extra.usage ?? { usd: 0, units: {} },
  interactionContext: extra.interactionContext,
  extensionSpan: "full",
  error: extra.error,
});

const imageDataUrl = (request: AdapterRequest) => {
  const first = request.refs?.find((ref) => ref.role === "first_frame" && ref.bytes);
  if (!first?.bytes) return undefined;
  const mime = first.mime ?? "image/jpeg";
  return `data:${mime};base64,${Buffer.from(first.bytes).toString("base64")}`;
};

export const createGoogleOmniAdapter = (): MediaAdapter => ({
  id: "google-omni",
  estimate: (request) => (request.durationSec ?? 8) * (capabilityById("video-omni")?.pricing.usd ?? 0.12),
  submit: async (request) => {
    const id = await submitGeminiVideo({
      model: "gemini-omni-1.1-flash",
      prompt: request.prompt,
      duration: request.durationSec ?? 8,
      resolution: request.resolution ?? "720p",
      aspectRatio: request.format ?? "9:16",
      imageDataUrl: imageDataUrl(request),
    });
    return toJob(id, "in_progress");
  },
  poll: async (providerJobId) => {
    const response = await fetch(`${API}/interactions/${encodeURIComponent(providerJobId)}`, {
      headers: { "x-goog-api-key": key() },
    });
    if (!response.ok) throw new Error(`Omni poll failed (${response.status}).`);
    const json = (await response.json()) as { status?: string; error?: { message?: string } };
    const status = json.status ?? "";
    if (status === "completed") return toJob(providerJobId, "completed");
    if (status === "failed" || status === "cancelled") {
      return toJob(providerJobId, "failed", { error: json.error?.message ?? status });
    }
    return toJob(providerJobId, "in_progress");
  },
  collect: async (providerJobId) => {
    const bytes = await finishGeminiVideo(providerJobId, async () => true);
    return toJob(providerJobId, "completed", {
      outputs: [{ mime: "video/mp4", bytes }],
      usage: { usd: (bytes.byteLength / 1_000_000) * 0.12, units: { bytes: bytes.byteLength } },
    });
  },
});
