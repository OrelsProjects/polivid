import assert from "node:assert/strict";
import test from "node:test";
import { imageRequestBody } from "./images";

test("reference pictures are sent as image-to-image inputs", () => {
  const body = imageRequestBody({
    modelId: "openai/gpt-image-2.5-sunburst",
    prompt: "Maya at the table.",
    format: "9:16",
    refs: [
      { role: "subject_ref", mime: "image/png", bytes: Uint8Array.from([1, 2, 3]) },
      { role: "style_ref", url: "data:image/jpeg;base64,AAAA" },
      { role: "first_frame", url: "data:image/png;base64,BBBB" },
    ],
  });
  assert.equal(body.aspect_ratio, "9:16");
  assert.equal(body.input_references?.length, 2);
  assert.equal(body.input_references?.[0]?.type, "image_url");
  assert.match(body.input_references?.[0]?.image_url.url ?? "", /^data:image\/png;base64,/);
  assert.equal(body.input_references?.[1]?.image_url.url, "data:image/jpeg;base64,AAAA");
});

test("plain prompts send no reference field", () => {
  const body = imageRequestBody({ modelId: "openai/gpt-image-2.5-flare", prompt: "A door." });
  assert.equal("input_references" in body, false);
  assert.equal(body.aspect_ratio, "9:16");
});
