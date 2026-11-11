import assert from "node:assert/strict";
import test from "node:test";
import { CLIP_ATTEMPTS, clipFailureAction, isModelChoice, MODEL_CHOICE_CODE } from "./model-choice";

test("a clip is tried three times, then the person picks another model", () => {
  assert.equal(CLIP_ATTEMPTS, 3);
  assert.equal(clipFailureAction(1, false), "retry");
  assert.equal(clipFailureAction(2, false), "retry");
  assert.equal(clipFailureAction(3, false), "ask");
  assert.equal(clipFailureAction(3, true), "stop");
});

test("a paused job is waiting for a model only when it says so", () => {
  assert.equal(isModelChoice({ code: MODEL_CHOICE_CODE }), true);
  assert.equal(isModelChoice({ code: "other" }), false);
  assert.equal(isModelChoice(null), false);
});
