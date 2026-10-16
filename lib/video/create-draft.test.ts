import assert from "node:assert/strict";
import test from "node:test";
import { parseCreateDraft } from "./create-draft";

test("reads a saved create draft", () => {
  const draft = parseCreateDraft(
    JSON.stringify({
      prompt: "Why sleep matters for memory",
      inputMode: "topic",
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

test("reads a saved preset and visual direction", () => {
  const draft = parseCreateDraft(
    JSON.stringify({ prompt: "Hello", presetId: "pixar", visualDirection: "Warm key light." }),
  );
  assert.equal(draft?.presetId, "pixar");
  assert.equal(draft?.visualDirection, "Warm key light.");
});
