import { capabilityById } from "../capabilities";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-omni-1.1-flash:generateContent";

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

export const createGoogleOmniAdapter = (): MediaAdapter => ({
  id: "google-omni",
  estimate: (request) => (request.durationSec ?? 8) * (capabilityById("video-omni")?.pricing.usd ?? 0.12),
  submit: async (request, idempotencyKey) => {
    const parts: Record<string, unknown>[] = [{ text: request.prompt }];
    for (const ref of request.refs ?? []) {
      if (!ref.bytes) continue;
      parts.push({
        inlineData: {
          mimeType: ref.mime ?? "image/jpeg",
          data: Buffer.from(ref.bytes).toString("base64"),
        },
      });
    }
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["VIDEO"],
        videoConfig: {
          durationSeconds: request.durationSec ?? 8,
          aspectRatio: request.format ?? "9:16",
        },
      },
      ...(request.interactionContext ? { interactionContext: request.interactionContext } : {}),
    };
    const response = await fetch(`${API}?key=${key()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Omni request failed (${response.status}).`);
    const json = (await response.json()) as {
      name?: string;
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
      interactionContext?: unknown;
    };
    const inline = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (inline?.data) {
      return toJob(json.name ?? idempotencyKey, "completed", {
        outputs: [{ mime: inline.mimeType ?? "video/mp4", bytes: Buffer.from(inline.data, "base64") }],
        usage: { usd: (request.durationSec ?? 8) * 0.12, units: { seconds: request.durationSec ?? 8 } },
        interactionContext: json.interactionContext,
      });
    }
    return toJob(json.name ?? idempotencyKey, "in_progress", { interactionContext: json.interactionContext });
  },
  poll: async (providerJobId) => toJob(providerJobId, "in_progress"),
  collect: async (providerJobId) => toJob(providerJobId, "failed", { error: "Omni job has no download URL; the submit response should include video bytes." }),
});
