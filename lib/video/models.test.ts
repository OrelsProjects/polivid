import assert from "node:assert/strict";
import test from "node:test";
import {
  clipDuration,
  clipResolution,
  GENERATION_MODELS,
  generationModelById,
  isVideoProvider,
  supportsReferenceImages,
} from "./models";

test("every generation model accepts a reference picture", () => {
  for (const model of GENERATION_MODELS) {
    assert.equal(supportsReferenceImages(model), true, model.id);
  }
});

test("every generation model names a known provider", () => {
  for (const model of GENERATION_MODELS) {
    assert.equal(isVideoProvider(model.provider), true, model.id);
  }
});

test("Gemini Omni goes to Google and snaps to 3–10 second portrait or landscape clips", () => {
  const omni = generationModelById("omni");
  assert.ok(omni);
  assert.equal(omni.provider, "google");
  assert.equal(clipDuration(2, omni.durations), 3);
  assert.equal(clipDuration(30, omni.durations), 10);
  assert.equal(clipResolution(omni.resolutions), "720p");
  assert.deepEqual([...omni.aspectRatios].sort(), ["16:9", "9:16"]);
});
