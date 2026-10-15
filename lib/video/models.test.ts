import assert from "node:assert/strict";
import test from "node:test";
import { GENERATION_MODELS, supportsReferenceImages } from "./models";

test("every generation model accepts a reference picture", () => {
  for (const model of GENERATION_MODELS) {
    assert.equal(supportsReferenceImages(model), true, model.id);
  }
});
