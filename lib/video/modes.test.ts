import assert from "node:assert/strict";
import test from "node:test";
import { modeAcceptsReferenceImages, resolveModeTier, videoModeById, VIDEO_MODES, VIDEO_TIERS } from "./modes";

test("every catalog mode is live and resolves a Pro tier", () => {
  for (const mode of VIDEO_MODES) {
    assert.equal(mode.status, "live", mode.id);
    const resolved = resolveModeTier(mode.id, "pro");
    assert.ok(resolved, mode.id);
    assert.ok(resolved?.model || resolved?.chatModel || mode.engine === "compose", mode.id);
  }
});

test("prompt mode maps Low, Pro, and Ultra to different models", () => {
  assert.equal(resolveModeTier("prompt", "low")?.model?.id, "wan");
  assert.equal(resolveModeTier("prompt", "pro")?.model?.id, "hailuo");
  assert.equal(resolveModeTier("prompt", "ultra")?.model?.id, "seedance");
});

test("image and avatar share first-frame models", () => {
  assert.equal(resolveModeTier("image", "pro")?.model?.id, "flux");
  assert.equal(resolveModeTier("avatar", "ultra")?.model?.id, "seedance");
});

test("motion graphics uses chat models", () => {
  assert.equal(resolveModeTier("motion-graphics", "low")?.chatModel, "anthropic/claude-sonnet-5.5");
  assert.equal(resolveModeTier("motion-graphics", "ultra")?.chatModel, "anthropic/claude-opus-5.5");
});

test("modes that take reference pictures only use models that accept them", () => {
  const prompt = videoModeById("prompt");
  assert.ok(prompt && modeAcceptsReferenceImages(prompt));
  for (const mode of VIDEO_MODES.filter(modeAcceptsReferenceImages)) {
    for (const tier of VIDEO_TIERS) {
      assert.equal(resolveModeTier(mode.id, tier)?.model?.referenceImages, true, `${mode.id} ${tier}`);
    }
  }
});

test("unknown tiers do not resolve", () => {
  assert.equal(resolveModeTier("prompt", "turbo"), null);
  assert.equal(resolveModeTier("unknown", "low"), null);
  assert.equal(videoModeById("unknown"), null);
});

test("a mode that films nothing resolves without a model", () => {
  const resolved = resolveModeTier("edit", "pro");
  assert.ok(resolved);
  assert.equal(resolved.model, null);
  assert.equal(resolved.chatModel, undefined);
  assert.equal(resolveModeTier("edit", "turbo"), null);
});

test("a direct prompt films with a video model, takes no pictures, and carries no voice", async () => {
  const { isDirectMode, modeAllowsMedia } = await import("./modes");
  const { modeCanNarrate } = await import("@/lib/voice/constants");
  const { isStitchedMode } = await import("./segments");
  const direct = videoModeById("direct");
  assert.ok(direct);
  assert.equal(isDirectMode("direct"), true);
  assert.equal(isDirectMode("prompt"), false);
  assert.equal(direct.engine, "video");
  assert.equal(direct.upload, "none");
  assert.equal(modeAcceptsReferenceImages(direct), false);
  assert.equal(modeAllowsMedia(direct, "stills"), false);
  assert.equal(modeCanNarrate("direct"), false);
  assert.equal(isStitchedMode("direct"), false, "one clip, never split into several");
  for (const tier of VIDEO_TIERS) assert.ok(resolveModeTier("direct", tier)?.model, tier);
});
