import { generateText } from "ai";
import { openrouter } from "@/lib/ai/openrouter";
import { capabilityById } from "../capabilities";
import type { AdapterJob, MediaAdapter } from "./types";

const pngFromDataUrl = (value: string) => {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
};

export const createImageAdapter = (): MediaAdapter => ({
  id: "images",
  estimate: (request) => capabilityById(request.modelId.includes("sunburst") ? "image-sunburst" : "image-flare")?.pricing.usd ?? 0.05,
  submit: async (request, idempotencyKey) => {
    const result = await generateText({
      model: openrouter().chat(request.modelId),
      prompt: request.prompt,
    });
    const fromText = pngFromDataUrl(result.text.trim());
    const file = (result as { files?: { uint8Array?: Uint8Array; mediaType?: string }[] }).files?.[0];
    const bytes = fromText?.bytes ?? (file?.uint8Array ? new Uint8Array(file.uint8Array) : new Uint8Array());
    const mime = fromText?.mime ?? file?.mediaType ?? "image/png";
    return {
      providerJobId: idempotencyKey,
      status: bytes.byteLength > 0 ? "completed" : "failed",
      outputs: bytes.byteLength > 0 ? [{ mime, bytes }] : [],
      usage: { usd: 0.05, units: { images: 1 } },
      error: bytes.byteLength > 0 ? undefined : "The image model returned no file.",
    };
  },
  poll: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
  collect: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
});
