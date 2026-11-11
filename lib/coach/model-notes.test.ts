import assert from "node:assert/strict";
import test from "node:test";
import { modelFromMessage, modelFromNote, modelIdForQueue, modelNote, proseWithoutModelNote } from "./model-notes";

test("a generation model note names a known footage model", () => {
  assert.equal(modelNote("wan"), "Generation model: wan");
  assert.equal(modelFromNote("Generation model: wan"), "wan");
  assert.equal(modelFromNote("Generation model: alibaba/wan-3.0"), "wan");
  assert.equal(modelFromNote("Generation model: nope"), "");
  assert.equal(proseWithoutModelNote("Approved.\nGeneration model: wan"), "Approved.");
});

test("the note on the message is the model that gets queued", () => {
  const message = {
    parts: [
      { type: "text", text: "Approved. Queue it exactly as written in the brief." },
      { type: "text", text: modelNote("seedance") },
    ],
  };
  assert.equal(modelFromMessage(message), "seedance");
  assert.equal(modelIdForQueue("seedance", "wan"), "seedance");
  assert.equal(modelIdForQueue("", "hailuo"), "hailuo");
  assert.equal(modelIdForQueue(undefined, "nope"), undefined);
});
