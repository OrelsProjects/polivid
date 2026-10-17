import assert from "node:assert/strict";
import test from "node:test";
import { CreateVideoSchema } from "./create-schema";
import { MAX_LYRICS_NOTE } from "./schema";

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
    cuts: [
      { seconds: 1, camera: "wide" },
      { seconds: 1, camera: "close-up" },
    ],
  });
  assert.equal(parsed.direction, "Handheld close-ups on the chorus.");
  assert.equal(parsed.scene, "A rooftop after rain.");
  assert.equal(parsed.directionKeys.length, 1);
  assert.equal(parsed.sceneKeys.length, 1);
  assert.equal(parsed.cuts?.length, 2);
  assert.equal(parsed.cuts?.[1]?.camera, "close-up");
});

test("CreateVideoSchema keeps a prompt brief and the pictures each shot uses", () => {
  const parsed = CreateVideoSchema.parse({
    prompt: "A fox crossing a snowy road at dusk",
    format: "9:16",
    length: 12,
    mode: "prompt",
    tier: "pro",
    brief: {
      subject: "A rust-orange fox",
      setting: "A snowy road at dusk",
      director: "Handheld",
      mustKeep: "Rust-orange fur",
      mustAvoid: "No other animals",
    },
    attachmentRoles: [{ index: 1, role: "subject" }],
    cuts: [{ seconds: 6, camera: "wide", images: [1] }, { seconds: 6, camera: "close" }],
  });
  assert.equal(parsed.brief?.subject, "A rust-orange fox");
  assert.equal(parsed.attachmentRoles?.[0]?.role, "subject");
  assert.deepEqual(parsed.cuts?.[0]?.images, [1]);
});

test("CreateVideoSchema rejects a zero-second cut", () => {
  const parsed = CreateVideoSchema.safeParse({
    prompt: "Hello there",
    format: "9:16",
    length: 10,
    cuts: [{ seconds: 0, camera: "wide" }],
  });
  assert.equal(parsed.success, false);
});

test("CreateVideoSchema rejects a too-long scene", () => {
  const parsed = CreateVideoSchema.safeParse({
    prompt: "Hello",
    format: "9:16",
    length: 15,
    scene: "x".repeat(MAX_LYRICS_NOTE + 1),
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
