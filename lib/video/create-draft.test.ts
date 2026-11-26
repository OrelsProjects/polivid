import assert from "node:assert/strict";
import test from "node:test";
import { parseCreateDraft } from "./create-draft";

test("reads a saved create draft", () => {
  const draft = parseCreateDraft(
    JSON.stringify({
      prompt: "Why sleep matters for memory",
      format: "9:16",
      length: 5,
      customLength: "5",
      model: "wan",
      tier: "pro",
      mediaKey: null,
      referenceKeys: ["uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"],
    }),
  );
  assert.equal(draft?.prompt, "Why sleep matters for memory");
  assert.equal(draft?.model, "wan");
  assert.deepEqual(draft?.referenceKeys, ["uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"]);
  assert.equal(draft?.showText, true);
  assert.equal(draft?.presetId, "auto");
  assert.equal(draft?.visualDirection, "");
  assert.equal(draft?.characterId, "");
});

test("reads an older voiceSettingId draft as a character id", () => {
  const draft = parseCreateDraft(
    JSON.stringify({
      prompt: "Hello",
      voiceSettingId: "11111111-2222-3333-4444-555555555555",
    }),
  );
  assert.equal(draft?.characterId, "11111111-2222-3333-4444-555555555555");
});

test("drops a broken draft", () => {
  assert.equal(parseCreateDraft(null), null);
  assert.equal(parseCreateDraft("{"), null);
  assert.equal(parseCreateDraft("[]"), null);
});

test("keeps on-screen text off when the draft says so", () => {
  const draft = parseCreateDraft(JSON.stringify({ prompt: "Hello", showText: false }));
  assert.equal(draft?.showText, false);
});

test("falls back when a field is missing", () => {
  const draft = parseCreateDraft(JSON.stringify({ prompt: "Hello" }));
  assert.equal(draft?.prompt, "Hello");
  assert.equal(draft?.format, "9:16");
  assert.equal(draft?.model, "wan");
  assert.deepEqual(draft?.referenceKeys, []);
  assert.equal(draft?.showText, true);
  assert.equal(draft?.presetId, "auto");
});

test("reads director notes and scene pictures", () => {
  const draft = parseCreateDraft(
    JSON.stringify({
      prompt: "Hello",
      direction: "Handheld close-ups",
      scene: "A rooftop at night",
      directionKeys: ["uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"],
      sceneKeys: ["not-an-upload", "uploads/user_abc/ffffffff-1111-2222-3333-444444444444.png"],
    }),
  );
  assert.equal(draft?.direction, "Handheld close-ups");
  assert.equal(draft?.scene, "A rooftop at night");
  assert.deepEqual(draft?.directionKeys, ["uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"]);
  assert.deepEqual(draft?.sceneKeys, ["uploads/user_abc/ffffffff-1111-2222-3333-444444444444.png"]);
});

test("reads a saved preset and visual direction", () => {
  const draft = parseCreateDraft(
    JSON.stringify({ prompt: "Hello", presetId: "pixar", visualDirection: "Warm key light." }),
  );
  assert.equal(draft?.presetId, "pixar");
  assert.equal(draft?.visualDirection, "Warm key light.");
});

test("a swap draft keeps the characters after the first, without repeats or the first one again", () => {
  const draft = parseCreateDraft(
    JSON.stringify({
      characterId: "11111111-1111-4111-8111-111111111111",
      swapExtras: [{ id: "22222222-2222-4222-8222-222222222222", lookId: "look-2" }, { id: "22222222-2222-4222-8222-222222222222" }, { id: "11111111-1111-4111-8111-111111111111" }, { id: 7 }, { id: "off" }, { id: "33333333-3333-4333-8333-333333333333" }, { id: "44444444-4444-4444-8444-444444444444" }, { id: "55555555-5555-4555-8555-555555555555" }],
    }),
  );
  assert.deepEqual(draft?.swapExtras, [
    { id: "22222222-2222-4222-8222-222222222222", lookId: "look-2" },
    { id: "33333333-3333-4333-8333-333333333333", lookId: "" },
    { id: "44444444-4444-4444-8444-444444444444", lookId: "" },
  ]);
  assert.deepEqual(parseCreateDraft(JSON.stringify({ prompt: "old" }))?.swapExtras, []);
});
