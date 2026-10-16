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

test("CreateVideoSchema keeps lyrics director notes and scene pictures", () => {
  const parsed = CreateVideoSchema.parse({
    prompt: "Style: pop\n[Verse]\nHello",
    format: "9:16",
    length: 15,
    mode: "lyrics",
    tier: "pro",
    direction: "Handheld close-ups on the chorus.",
    scene: "A rooftop after rain.",
    directionKeys: ["uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"],
    sceneKeys: ["uploads/user_abc/ffffffff-1111-2222-3333-444444444444.png"],
  });
  assert.equal(parsed.direction, "Handheld close-ups on the chorus.");
  assert.equal(parsed.scene, "A rooftop after rain.");
  assert.equal(parsed.directionKeys.length, 1);
  assert.equal(parsed.sceneKeys.length, 1);
});

test("CreateVideoSchema rejects a too-long scene", () => {
  const parsed = CreateVideoSchema.safeParse({
    prompt: "Hello",
    format: "9:16",
    length: 15,
    scene: "x".repeat(2001),
  });
  assert.equal(parsed.success, false);
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
