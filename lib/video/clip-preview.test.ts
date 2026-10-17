import assert from "node:assert/strict";
import test from "node:test";
import { clipIndexFromParam, clipPreviewSlots } from "./clip-preview";

const songArtifacts = {
  song: {
    style: "pop",
    sections: [],
    words: [],
    prompts: ["one", "two", "three"],
    shots: [
      { index: 0, startSec: 0, durationSec: 4, lines: ["a"], kind: "performance", sectionName: "Verse" },
      { index: 1, startSec: 4, durationSec: 4, lines: ["b"], kind: "broll", sectionName: "Verse" },
      { index: 2, startSec: 8, durationSec: 5, lines: ["c"], kind: "performance", sectionName: "Chorus" },
    ],
  },
  segments: [4, 4, 5],
  beats: ["one", "two", "three"],
};

test("a stored song keeps later shots when an earlier one is still filming", () => {
  const slots = clipPreviewSlots(songArtifacts, { mode: "lyrics", cuts: [] }, new Set([2]));
  assert.deepEqual(
    slots.map((slot) => [slot.index, slot.startSec, slot.ready]),
    [
      [0, 0, false],
      [1, 4, false],
      [2, 8, true],
    ],
  );
});

test("a stitch plan builds a timeline from clip lengths", () => {
  const slots = clipPreviewSlots(
    { segments: [7, 6], beats: ["wide", "close"] },
    { mode: "prompt", cuts: [] },
    new Set([0]),
  );
  assert.deepEqual(slots, [
    { index: 0, startSec: 0, durationSec: 7, ready: true },
    { index: 1, startSec: 7, durationSec: 6, ready: false },
  ]);
});

test("lyrics cuts stand in until the song is stored", () => {
  const slots = clipPreviewSlots({}, { mode: "lyrics", cuts: [{ seconds: 3 }, { seconds: 5 }] }, new Set());
  assert.deepEqual(slots, [
    { index: 0, startSec: 0, durationSec: 3, ready: false },
    { index: 1, startSec: 3, durationSec: 5, ready: false },
  ]);
});

test("prompt cuts stand in until the clips are stored", () => {
  const slots = clipPreviewSlots({}, { mode: "prompt", cuts: [{ seconds: 4 }, { seconds: 8 }] }, new Set([1]));
  assert.deepEqual(slots, [
    { index: 0, startSec: 0, durationSec: 4, ready: false },
    { index: 1, startSec: 4, durationSec: 8, ready: true },
  ]);
});

test("a single clip has no shot preview", () => {
  assert.deepEqual(clipPreviewSlots({}, { mode: "prompt", cuts: [] }, new Set([0])), []);
  assert.deepEqual(
    clipPreviewSlots({}, { mode: "lyrics", cuts: [{ seconds: 8 }] }, new Set([0])),
    [],
  );
});

test("shot route params stay inside the clip limit", () => {
  assert.equal(clipIndexFromParam("0"), 0);
  assert.equal(clipIndexFromParam("12"), 12);
  assert.equal(clipIndexFromParam("60"), null);
  assert.equal(clipIndexFromParam("01"), 1);
  assert.equal(clipIndexFromParam("-1"), null);
  assert.equal(clipIndexFromParam("1e1"), null);
  assert.equal(clipIndexFromParam("2/../x"), null);
});
