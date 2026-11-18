/**
 * AI upscaling of a small picture through OpenRouter. None of our providers sells a true super-resolution
 * model, so this asks an image editing model to redraw the same photo at 2K, changing nothing else.
 * Nano Banana 2.1 is used because it keeps faces closest to the source when editing.
 * Callers should fall back to a plain resize if this throws.
 */
import { bytesFromImage, IMAGE_REQUEST_TIMEOUT_MS } from "@/lib/production/adapters/images";

export const UPSCALE_MODEL = "google/gemini-nano-banana-2.1";

export const UPSCALE_PROMPT = [
  "Upscale this exact photo to a higher resolution.",
  "Keep everything the same: the same person, face, expression, hair, clothes, pose, background, framing, and colors.",
  "Only add sharpness and fine detail. Do not add, remove, move, or restyle anything.",
  "Keep any plain white margins plain white.",
].join(" ");

/** Shapes the model can return that Kling also takes for a character picture (1:2.5 to 2.5:1). */
export const UPSCALE_ASPECTS = [
  { label: "9:16", ratio: 9 / 16 },
  { label: "2:3", ratio: 2 / 3 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "1:1", ratio: 1 },
  { label: "5:4", ratio: 5 / 4 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "21:9", ratio: 21 / 9 },
] as const;

export type UpscaleAspect = (typeof UPSCALE_ASPECTS)[number];

/** The supported shape closest to the picture's, so the margins it needs are as thin as possible. */
export const upscaleAspectFor = (width: number, height: number): UpscaleAspect => {
  const target = Math.log(width / height);
  return UPSCALE_ASPECTS.reduce((best, aspect) =>
    Math.abs(Math.log(aspect.ratio) - target) < Math.abs(Math.log(best.ratio) - target) ? aspect : best,
  );
};

/**
 * The canvas a picture is padded to before upscaling, so it already has the requested shape and the
 * model has nothing to crop or invent. Sides are even for JPEG.
 */
export const upscaleCanvasFor = (width: number, height: number, aspect: UpscaleAspect) => {
  const even = (value: number) => Math.ceil(value / 2) * 2;
  return width / height < aspect.ratio
    ? { width: even(height * aspect.ratio), height: even(height) }
    : { width: even(width), height: even(width / aspect.ratio) };
};

export const upscaleRequestBody = (dataUrl: string, aspect: UpscaleAspect) => ({
  model: UPSCALE_MODEL,
  prompt: UPSCALE_PROMPT,
  aspect_ratio: aspect.label,
  resolution: "2K",
  n: 1,
  input_references: [{ type: "image_url", image_url: { url: dataUrl } }],
});

/** Sends one picture to the upscaler and returns the new image. Throws on any failure. */
export const upscalePicture = async (bytes: Uint8Array, mime: string, aspect: UpscaleAspect) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(upscaleRequestBody(dataUrl, aspect)),
    signal: AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Upscale request failed (${response.status}). ${detail.slice(0, 180)}`);
  }
  const json = (await response.json()) as { data?: { b64_json?: string; url?: string }[]; usage?: { cost?: number }; error?: { message?: string } };
  const image = await bytesFromImage(json.data?.[0]);
  if (image.bytes.byteLength === 0) throw new Error(json.error?.message ?? "The upscaler returned no image.");
  return { bytes: new Uint8Array(image.bytes), mime: image.mime, usd: json.usage?.cost ?? null };
};
