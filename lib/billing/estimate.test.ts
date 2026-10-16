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

test("stitched modes price the filmed segment seconds", () => {
  assert.equal(videoJobCredits({ mode: "prompt", modelId: "wan", resolution: "720p", length: 13 }), 130);
  assert.equal(videoJobCredits({ mode: "prompt", modelId: "hailuo", length: 2 }), 65);
  assert.equal(videoJobCredits({ mode: "avatar", modelId: "wan", resolution: "720p", length: 2 }), 20);
});

test("lyrics prices one song plus the filmed clips", () => {
  const picture = videoJobCredits({ mode: "prompt", modelId: "wan", resolution: "720p", length: 14 });
  const song = videoJobCredits({ mode: "lyrics", modelId: "wan", resolution: "720p", length: 14 });
  const singer = videoJobCredits({
    mode: "lyrics",
    modelId: "wan",
    resolution: "720p",
    length: 14,
    referenceCount: 1,
  });
  assert.ok(song > picture);
  assert.ok(singer > song);
});

test("mode and tier pick the model when one is not passed", () => {
  assert.equal(
    videoJobCredits({ mode: "prompt", tier: "low", length: 13 }),
    videoJobCredits({ mode: "prompt", modelId: "wan", resolution: "480p", length: 13 }),
  );
});
