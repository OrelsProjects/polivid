import assert from "node:assert/strict";
import test from "node:test";
import { resolveModeTier, videoModeById, VIDEO_MODES } from "./modes";

test("every catalog mode is live and resolves a Pro tier", () => {
  for (const mode of VIDEO_MODES) {
    assert.equal(mode.status, "live", mode.id);
    const resolved = resolveModeTier(mode.id, "pro");
    assert.ok(resolved, mode.id);
    assert.ok(resolved?.model || resolved?.chatModel, mode.id);
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

test("unknown tiers do not resolve", () => {
  assert.equal(resolveModeTier("prompt", "turbo"), null);
  assert.equal(resolveModeTier("unknown", "low"), null);
  assert.equal(videoModeById("unknown"), null);
});
