import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  UPSCALE_ASPECTS,
  UPSCALE_MODEL,
  upscaleAspectFor,
  upscaleCanvasFor,
  upscalePicture,
  upscaleRequestBody,
} from "./upscale";

const realFetch = globalThis.fetch;
const realKey = process.env.OPENROUTER_API_KEY;

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.OPENROUTER_API_KEY = realKey;
});

test("the closest supported shape is picked, within what Kling takes", () => {
  assert.equal(upscaleAspectFor(226, 627).label, "9:16");
  assert.equal(upscaleAspectFor(189, 247).label, "3:4");
  assert.equal(upscaleAspectFor(400, 400).label, "1:1");
  assert.equal(upscaleAspectFor(1920, 1080).label, "16:9");
  for (const aspect of UPSCALE_ASPECTS) assert.ok(aspect.ratio >= 0.4 && aspect.ratio <= 2.5, aspect.label);
});

test("the canvas holds the whole picture at the requested shape, with even sides", () => {
  for (const [w, h] of [[226, 627], [189, 247], [300, 120], [301, 301], [511, 333]]) {
    const aspect = upscaleAspectFor(w, h);
    const canvas = upscaleCanvasFor(w, h, aspect);
    assert.ok(canvas.width >= w && canvas.height >= h, `${w}x${h} -> ${canvas.width}x${canvas.height}`);
    assert.equal(canvas.width % 2, 0);
    assert.equal(canvas.height % 2, 0);
    assert.ok(Math.abs(canvas.width / canvas.height / aspect.ratio - 1) < 0.03, `${w}x${h} shape`);
  }
});

test("the request asks for the same photo at 2K", () => {
  const body = upscaleRequestBody("data:image/png;base64,AAAA", upscaleAspectFor(226, 627));
  assert.equal(body.model, UPSCALE_MODEL);
  assert.equal(body.resolution, "2K");
  assert.equal(body.aspect_ratio, "9:16");
  assert.deepEqual(body.input_references, [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }]);
  assert.match(body.prompt, /Upscale this exact photo/);
});

test("upscalePicture returns the image the model sends back", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let sent: { model?: string; resolution?: string } = {};
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }], usage: { cost: 0.039 } }), { status: 200 });
  }) as typeof fetch;
  const result = await upscalePicture(new Uint8Array([1, 2, 3]), "image/png", upscaleAspectFor(226, 627));
  assert.equal(Buffer.from(result.bytes).toString(), "png-bytes");
  assert.equal(result.usd, 0.039);
  assert.equal(sent.model, UPSCALE_MODEL);
  assert.equal(sent.resolution, "2K");
});

test("upscalePicture throws on an error status or an empty answer, so callers resize instead", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(upscalePicture(new Uint8Array([1]), "image/png", upscaleAspectFor(200, 200)), /429/);
  globalThis.fetch = (async () => new Response(JSON.stringify({ data: [], error: { message: "blocked" } }), { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(upscalePicture(new Uint8Array([1]), "image/png", upscaleAspectFor(200, 200)), /blocked/);
});

test("upscalePicture needs the OpenRouter key", async () => {
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(upscalePicture(new Uint8Array([1]), "image/png", upscaleAspectFor(200, 200)), /OPENROUTER_API_KEY/);
});
