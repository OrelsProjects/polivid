import { capabilityById } from "../capabilities";
import { clipDuration, clipResolution, generationModelBySlug } from "@/lib/video/models";
import { downloadOpenRouterVideoJob, finishFootage, submitOpenRouterVideoJob } from "@/lib/video/footage";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const toJob = (providerJobId: string, status: AdapterJob["status"], bytes?: Uint8Array, usd = 0): AdapterJob => ({
  providerJobId,
  status,
  outputs: bytes ? [{ mime: "video/mp4", bytes }] : [],
  usage: { usd, units: { seconds: 1 } },
  extensionSpan: "new_only",
});

export const createOpenRouterVideoAdapter = (): MediaAdapter => ({
  id: "openrouter-video",
  estimate: (request) => {
    const cap = capabilityById(
      request.modelId.includes("hailuo") ? "video-hailuo" : request.modelId.includes("seedance") ? "video-seedance" : "video-wan",
    );
    return (request.durationSec ?? 5) * (cap?.pricing.usd ?? 0.1);
  },
  submit: async (request) => {
    const model = generationModelBySlug(request.modelId);
    if (!model) throw new Error(`Unknown OpenRouter video model ${request.modelId}.`);
    const duration = clipDuration(request.durationSec ?? model.durations[0], model.durations);
    const first = request.refs?.find((ref) => ref.role === "first_frame");
    const last = request.refs?.find((ref) => ref.role === "last_frame");
    const frameImages = [
      ...(first?.url
        ? [{ type: "image_url", image_url: { url: first.url }, frame_type: "first_frame" }]
        : []),
      ...(last?.url ? [{ type: "image_url", image_url: { url: last.url }, frame_type: "last_frame" }] : []),
    ];
    const id = await submitOpenRouterVideoJob({
      model: model.slug,
      prompt: request.prompt,
      duration,
      resolution: request.resolution && model.resolutions.includes(request.resolution)
        ? request.resolution
        : clipResolution(model.resolutions),
      aspect_ratio: request.format,
      generate_audio: model.audio,
      ...(frameImages.length ? { frame_images: frameImages } : {}),
    });
    return toJob(id, "in_progress");
  },
  poll: async (providerJobId) => {
    const response = await fetch(`https://openrouter.ai/api/v1/videos/${providerJobId}`, {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    if (!response.ok) throw new Error(`OpenRouter poll failed (${response.status}).`);
    const job = (await response.json()) as { status?: string };
    if (job.status === "completed") return toJob(providerJobId, "completed");
    if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") {
      return { ...toJob(providerJobId, job.status === "expired" ? "expired" : "failed"), error: job.status };
    }
    return toJob(providerJobId, "in_progress");
  },
  collect: async (providerJobId) => {
    try {
      const bytes = await downloadOpenRouterVideoJob(providerJobId);
      return toJob(providerJobId, "completed", bytes);
    } catch {
      const bytes = await finishFootage(providerJobId, "openrouter", async () => true);
      return toJob(providerJobId, "completed", bytes);
    }
  },
});
