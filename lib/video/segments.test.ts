import assert from "node:assert/strict";
import test from "node:test";
import { formatClipSplit, isStitchedMode, planSegments, readStitchPlan, STITCHED_MODES } from "./segments";

const seconds = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, index) => min + index);

const WAN = seconds(2, 30);
const HAILUO = seconds(5, 15);

test("short requests stay one clip", () => {
  assert.deepEqual(planSegments(2, WAN), [2]);
  assert.deepEqual(planSegments(5, WAN), [5]);
  assert.deepEqual(planSegments(7, WAN), [7]);
});

test("a length the model can film stays one clip", () => {
  assert.deepEqual(planSegments(8, WAN), [8]);
  assert.deepEqual(planSegments(10, WAN), [10]);
  assert.deepEqual(planSegments(13, WAN), [13]);
  assert.deepEqual(planSegments(30, WAN), [30]);
  assert.deepEqual(planSegments(13, HAILUO), [13]);
  assert.deepEqual(planSegments(15, HAILUO), [15]);
});

test("a length past the model maximum splits into the fewest clips that fit", () => {
  assert.deepEqual(planSegments(31, WAN), [16, 15]);
  assert.deepEqual(planSegments(60, WAN), [30, 30]);
  assert.deepEqual(planSegments(90, WAN), [30, 30, 30]);
  assert.deepEqual(planSegments(16, HAILUO), [8, 8]);
  assert.deepEqual(planSegments(40, HAILUO), [14, 13, 13]);
});

test("a 5-15s model snaps a short request up to its minimum", () => {
  assert.deepEqual(planSegments(2, HAILUO), [5]);
  assert.deepEqual(planSegments(8, HAILUO), [8]);
});

test("isStitchedMode covers footage modes and legacy jobs", () => {
  for (const mode of STITCHED_MODES) {
    assert.equal(isStitchedMode(mode), true, mode);
  }
  assert.equal(isStitchedMode(undefined), true);
  assert.equal(isStitchedMode(""), true);
  assert.equal(isStitchedMode(null), true);
  assert.equal(isStitchedMode("avatar"), false);
  assert.equal(isStitchedMode("music"), false);
  assert.equal(isStitchedMode("motion-graphics"), false);
  assert.equal(isStitchedMode("captions"), false);
});

test("formatClipSplit names the chain for the Create form", () => {
  assert.equal(formatClipSplit([13]), "");
  assert.equal(formatClipSplit([7, 6]), "Filmed as 2 clips · 7s + 6s");
  assert.equal(formatClipSplit([6, 5, 5]), "Filmed as 3 clips · 6s + 5s + 5s");
});

test("readStitchPlan accepts a saved beat chain", () => {
  assert.deepEqual(readStitchPlan({ segments: [7, 6], beats: ["Walk in.", "Keep walking."] }), {
    segments: [7, 6],
    beats: ["Walk in.", "Keep walking."],
  });
  assert.equal(readStitchPlan({}), null);
  assert.equal(readStitchPlan({ segments: [13], beats: ["One clip."] }), null);
  assert.equal(readStitchPlan({ segments: [7, 6], beats: ["Only one"] }), null);
});
