import assert from "node:assert/strict";
import test from "node:test";
import { CreateVideoSchema } from "./create-schema";

test("CreateVideoSchema accepts preset and visual direction", () => {
  const parsed = CreateVideoSchema.parse({
    prompt: "A fox crossing a snowy road at dusk",
    format: "9:16",
    length: 15,
    mode: "prompt",
    tier: "pro",
    presetId: "pixar",
    visualDirection: "Keep the fox rust-orange in every shot.",
  });
  assert.equal(parsed.presetId, "pixar");
  assert.equal(parsed.visualDirection, "Keep the fox rust-orange in every shot.");
  assert.equal(parsed.showText, true);
  assert.equal(parsed.characterId, "");
});

test("CreateVideoSchema keeps a saved character id", () => {
  const parsed = CreateVideoSchema.parse({
    prompt: "A fox crossing a snowy road at dusk",
    format: "9:16",
    length: 15,
    characterId: "11111111-2222-3333-4444-555555555555",
  });
  assert.equal(parsed.characterId, "11111111-2222-3333-4444-555555555555");
});

test("CreateVideoSchema rejects a too-long visual direction", () => {
  const parsed = CreateVideoSchema.safeParse({
    prompt: "A fox",
    format: "9:16",
    length: 15,
    visualDirection: "x".repeat(601),
  });
  assert.equal(parsed.success, false);
});
