import assert from "node:assert/strict";
import test from "node:test";
import { characterNote, pickReferenceClip, pickReferenceKeys, type CharacterMediaItem } from "./media";

let n = 0;
const item = (patch: Partial<CharacterMediaItem>): CharacterMediaItem => ({
  id: `m${++n}`,
  kind: "image",
  key: `k${n}`,
  url: "",
  label: "other",
  lookId: null,
  caption: null,
  durationSec: null,
  sourceMediaId: null,
  position: n,
  ...patch,
});

test("the main picture leads, then one picture per label, identity first", () => {
  const media = [
    item({ key: "main", label: "face" }),
    item({ key: "body", label: "full_body" }),
    item({ key: "face2", label: "face" }),
    item({ key: "side", label: "profile" }),
    item({ key: "clip", kind: "video" }),
  ];
  assert.deepEqual(pickReferenceKeys({ mainKey: "main", media, max: 4 }), ["main", "side", "body", "face2"]);
  assert.deepEqual(pickReferenceKeys({ mainKey: "main", media, max: 2 }), ["main", "side"]);
  assert.deepEqual(pickReferenceKeys({ mainKey: "main", media, max: 0 }), []);
});

test("a look's pictures come first and other looks are left out", () => {
  const media = [
    item({ key: "main", label: "face" }),
    item({ key: "gym-body", label: "full_body", lookId: "gym" }),
    item({ key: "office-body", label: "full_body", lookId: "office" }),
    item({ key: "side", label: "profile" }),
  ];
  const picked = pickReferenceKeys({ mainKey: "main", media, lookId: "gym", max: 4 });
  assert.equal(picked[0], "gym-body");
  assert.ok(picked.includes("main"));
  assert.ok(!picked.includes("office-body"));
});

test("clips prefer the look, then a clip with no look", () => {
  const media = [item({ key: "c1", kind: "video", lookId: "gym" }), item({ key: "c2", kind: "video" })];
  assert.equal(pickReferenceClip(media, "gym")?.key, "c1");
  assert.equal(pickReferenceClip(media, null)?.key, "c2");
  assert.equal(pickReferenceClip([], null), null);
});

test("the note carries description, look, personality, and voice only when asked", () => {
  const note = characterNote(
    { name: "Maya", description: "Late 30s, short dark hair.", personality: "Dry humour", speakingStyle: "Fast and warm" },
    { name: "Office", wardrobe: "navy blazer" },
  );
  assert.match(note, /Maya: Late 30s, short dark hair/);
  assert.match(note, /"Office" look: navy blazer/);
  assert.match(note, /Personality: Dry humour/);
  assert.doesNotMatch(note, /Speaks/);
  assert.match(characterNote({ name: "Maya", speakingStyle: "Fast" }, null, { voice: true }), /Speaks: Fast/);
  assert.equal(characterNote({ name: "Maya" }), "");
});
