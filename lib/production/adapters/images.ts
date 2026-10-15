import { capabilityById } from "../capabilities";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const refUrl = (ref: NonNullable<AdapterRequest["refs"]>[number]) =>
  ref.url ?? (ref.bytes && ref.mime ? `data:${ref.mime};base64,${Buffer.from(ref.bytes).toString("base64")}` : null);

/** The OpenRouter Images body. Reference pictures go in as image-to-image inputs. */
export const imageRequestBody = (request: AdapterRequest) => {
  const references = (request.refs ?? [])
    .filter((ref) => ref.role === "subject_ref" || ref.role === "style_ref")
    .map(refUrl)
    .filter((url): url is string => Boolean(url));
  return {
    model: request.modelId,
    prompt: request.prompt,
    aspect_ratio: request.format ?? "9:16",
    n: 1,
    output_format: "png",
    ...(references.length > 0 ? { input_references: references.map((url) => ({ type: "image_url", image_url: { url } })) } : {}),
  };
};

const pngFromDataUrl = (value: string) => {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
};

const bytesFromImage = async (image: { b64_json?: string; url?: string } | undefined) => {
  if (image?.b64_json) {
    const fromUrl = pngFromDataUrl(image.b64_json.startsWith("data:") ? image.b64_json : `data:image/png;base64,${image.b64_json}`);
    if (fromUrl) return fromUrl;
    return { mime: "image/png", bytes: Buffer.from(image.b64_json, "base64") };
  }
  if (image?.url) {
    const file = await fetch(image.url);
    if (!file.ok) return { mime: "image/png", bytes: new Uint8Array() };
    return {
      mime: file.headers.get("content-type") ?? "image/png",
      bytes: Buffer.from(await file.arrayBuffer()),
    };
  }
  return { mime: "image/png", bytes: new Uint8Array() };
};

export const createImageAdapter = (): MediaAdapter => ({
  id: "images",
  estimate: (request) => capabilityById(request.modelId.includes("sunburst") ? "image-sunburst" : "image-flare")?.pricing.usd ?? 0.05,
  submit: async (request, idempotencyKey) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");
    const response = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(imageRequestBody(request)),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Image request failed (${response.status}). ${detail.slice(0, 180)}`);
    }
    const json = (await response.json()) as {
      data?: { b64_json?: string; url?: string }[];
      usage?: { cost?: number };
      error?: { message?: string };
    };
    const { mime, bytes } = await bytesFromImage(json.data?.[0]);
    return {
      providerJobId: idempotencyKey,
      status: bytes.byteLength > 0 ? "completed" : "failed",
      outputs: bytes.byteLength > 0 ? [{ mime, bytes }] : [],
      usage: { usd: json.usage?.cost ?? 0.08, units: { images: 1 } },
      error: bytes.byteLength > 0 ? undefined : json.error?.message ?? "The image model returned no file.",
    } satisfies AdapterJob;
  },
  poll: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
  collect: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
});
