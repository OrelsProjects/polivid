import assert from "node:assert/strict";
import test from "node:test";
import { productionCredits, videoJobCredits } from "./estimate";

test("a 30s Wan 720p video costs 300 credits", () => {
  assert.equal(videoJobCredits({ modelId: "wan", resolution: "720p", length: 30 }), 300);
});

test("demo and editor exports cost nothing", () => {
  assert.equal(videoJobCredits({ demo: true, modelId: "wan", resolution: "720p", length: 30 }), 0);
  assert.equal(videoJobCredits({ mode: "editor-export", length: 90 }), 0);
});

test("motion graphics uses a small flat table", () => {
  assert.equal(videoJobCredits({ mode: "motion-graphics", tier: "low", length: 30 }), 15);
  assert.equal(videoJobCredits({ mode: "motion-graphics", tier: "pro", length: 30 }), 40);
  assert.equal(videoJobCredits({ mode: "motion-graphics", tier: "ultra", length: 30 }), 80);
});

test("production estimates round provider USD up to credits", () => {
  assert.equal(productionCredits(3.01), 301);
  assert.equal(productionCredits(0.004), 5);
  assert.equal(productionCredits(12.4, true), 0);
});
