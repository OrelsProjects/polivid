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

test("captions cost the same at every length, tier, and model", () => {
  assert.equal(videoJobCredits({ mode: "captions", tier: "low", length: 5 }), 10);
  assert.equal(videoJobCredits({ mode: "captions", tier: "ultra", modelId: "seedance", resolution: "720p", length: 90 }), 10);
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

test("a cut every second costs more than one long shot", () => {
  const cuts = Array.from({ length: 10 }, () => ({ seconds: 1, camera: "new angle" }));
  const steady = videoJobCredits({ mode: "lyrics", modelId: "hailuo", length: 10, songReady: true });
  const quick = videoJobCredits({
    mode: "lyrics",
    modelId: "hailuo",
    length: 10,
    songReady: true,
    cuts,
  });
  assert.ok(quick > steady);
  const promptSteady = videoJobCredits({ mode: "prompt", modelId: "hailuo", length: 10 });
  const promptQuick = videoJobCredits({ mode: "prompt", modelId: "hailuo", length: 10, cuts });
  assert.ok(promptQuick > promptSteady);
});

test("mode and tier pick the model when one is not passed", () => {
  assert.equal(
    videoJobCredits({ mode: "prompt", tier: "low", length: 13 }),
    videoJobCredits({ mode: "prompt", modelId: "wan", resolution: "480p", length: 13 }),
  );
});

test("animated stills cost well under a third of filming the same length", () => {
  const filmed = videoJobCredits({ modelId: "wan", resolution: "720p", length: 30 });
  const pro = videoJobCredits({ mode: "voiceover", media: "stills", tier: "pro", length: 30 });
  const low = videoJobCredits({ mode: "voiceover", media: "stills", tier: "low", length: 30 });
  assert.equal(pro, 55);
  assert.equal(low, 31);
  assert.ok(pro * 3 < filmed, `${pro} vs ${filmed}`);
  assert.ok(low < pro);
});

test("a stills job is priced the same way when only its stored model is known", () => {
  assert.equal(
    videoJobCredits({ mode: "voiceover", tier: "pro", modelSlug: "stills", length: 30 }),
    videoJobCredits({ mode: "voiceover", media: "stills", tier: "pro", length: 30 }),
  );
  assert.equal(videoJobCredits({ demo: true, media: "stills", length: 30 }), 0);
});

test("stills cost grows with the pictures, then stops at the picture limit", () => {
  const at = (length: number) => videoJobCredits({ media: "stills", tier: "pro", length });
  assert.ok(at(10) < at(30));
  assert.ok(at(30) < at(60));
  assert.ok(at(90) - at(80) <= 1, "past sixteen pictures only the voice adds cost");
});

test("narration over a loop is the cheapest way to make a video", () => {
  const loop = (length: number) => videoJobCredits({ mode: "voiceover", media: "loop", length });
  assert.equal(loop(30), 12);
  assert.equal(loop(60), 15);
  assert.equal(loop(180), 29);
  assert.ok(loop(60) < videoJobCredits({ mode: "voiceover", media: "stills", tier: "low", length: 60 }));
  assert.equal(videoJobCredits({ mode: "voiceover", modelSlug: "loop", length: 60 }), loop(60));
});

test("a direct prompt is charged for the one clip the model films", () => {
  const at = (length: number) => videoJobCredits({ mode: "direct", modelId: "wan", resolution: "720p", length });
  assert.equal(at(30), 300, "the same rate as any Wan clip");
  assert.equal(at(60), at(30), "Wan films 30 seconds at most, so a longer ask costs the same");
  assert.ok(at(10) < at(30));
});
