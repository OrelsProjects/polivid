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

test("8 and 9 stay one clip so nothing is shorter than 5", () => {
  assert.deepEqual(planSegments(8, WAN), [8]);
  assert.deepEqual(planSegments(9, WAN), [9]);
});

test("splits into the fewest 5-7 second clips", () => {
  assert.deepEqual(planSegments(10, WAN), [5, 5]);
  assert.deepEqual(planSegments(12, WAN), [6, 6]);
  assert.deepEqual(planSegments(13, WAN), [7, 6]);
  assert.deepEqual(planSegments(15, WAN), [5, 5, 5]);
  assert.deepEqual(planSegments(16, WAN), [6, 5, 5]);
  assert.deepEqual(planSegments(22, WAN), [6, 6, 5, 5]);
  assert.deepEqual(planSegments(30, WAN), [6, 6, 6, 6, 6]);
  assert.deepEqual(planSegments(90, WAN), [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6]);
});

test("a 5-15s model snaps a short request up to its minimum", () => {
  assert.deepEqual(planSegments(2, HAILUO), [5]);
  assert.deepEqual(planSegments(13, HAILUO), [7, 6]);
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
