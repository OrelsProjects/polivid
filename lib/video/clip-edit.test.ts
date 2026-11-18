import assert from "node:assert/strict";
import test from "node:test";
import {
  clipClock,
  clipRangesProblem,
  cutTimeAt,
  keepsEverything,
  keptRanges,
  keptSeconds,
  moveEdge,
  playbackTime,
  sectionsFromRanges,
  splitAt,
  toggleSection,
  trimTo,
  wholeClip,
} from "./clip-edit";

test("a new clip keeps the whole video", () => {
  assert.deepEqual(keptRanges(wholeClip(22.8)), [{ start: 0, end: 22.8 }]);
  assert.equal(keepsEverything(keptRanges(wholeClip(22.8)), 22.8), true);
});

test("split, then remove the middle, keeps the two ends", () => {
  let clip = splitAt(wholeClip(20), 5);
  clip = splitAt(clip, 12);
  assert.equal(clip.length, 3);
  clip = toggleSection(clip, 1);
  assert.deepEqual(keptRanges(clip), [
    { start: 0, end: 5 },
    { start: 12, end: 20 },
  ]);
  assert.equal(keptSeconds(keptRanges(clip)), 13);
  // Bringing it back joins everything into one kept part again.
  assert.deepEqual(keptRanges(toggleSection(clip, 1)), [{ start: 0, end: 20 }]);
});

test("a split too close to an edge does nothing, and the last kept part can't be removed", () => {
  assert.equal(splitAt(wholeClip(10), 0.05).length, 1);
  assert.equal(splitAt(wholeClip(10), 9.9).length, 1);
  assert.deepEqual(keptRanges(toggleSection(wholeClip(10), 0)), [{ start: 0, end: 10 }]);
});

test("trimming the start and end removes what is outside, and dragging back restores it", () => {
  let clip = trimTo(wholeClip(22.8), "start", 4);
  clip = trimTo(clip, "end", 12);
  assert.deepEqual(keptRanges(clip), [{ start: 4, end: 12 }]);
  assert.deepEqual(keptRanges(trimTo(clip, "start", 2)), [{ start: 2, end: 12 }]);
  assert.deepEqual(keptRanges(trimTo(clip, "end", 15)), [{ start: 4, end: 15 }]);
  // A handle can't cross the other side of its kept part.
  assert.deepEqual(keptRanges(trimTo(clip, "start", 30)), [{ start: 11.8, end: 12 }]);
});

test("trimming keeps cuts made in the middle", () => {
  let clip = toggleSection(splitAt(splitAt(wholeClip(20), 8), 10), 1);
  clip = trimTo(clip, "start", 2);
  assert.deepEqual(keptRanges(clip), [
    { start: 2, end: 8 },
    { start: 10, end: 20 },
  ]);
});

test("dragging an edge moves the cut, but never makes a section vanish", () => {
  const clip = toggleSection(splitAt(wholeClip(10), 4), 1);
  assert.deepEqual(keptRanges(moveEdge(clip, 0, 6)), [{ start: 0, end: 6 }]);
  assert.deepEqual(keptRanges(moveEdge(clip, 0, 50)), [{ start: 0, end: 9.8 }]);
});

test("saved ranges reopen as the same sections", () => {
  const ranges = [
    { start: 1, end: 3 },
    { start: 6, end: 9 },
  ];
  assert.deepEqual(keptRanges(sectionsFromRanges(ranges, 12)), ranges);
});

test("preview playback skips removed parts and stops after the last kept one", () => {
  const ranges = [
    { start: 1, end: 3 },
    { start: 6, end: 9 },
  ];
  assert.equal(playbackTime(ranges, 0), 1);
  assert.equal(playbackTime(ranges, 2), 2);
  assert.equal(playbackTime(ranges, 4), 6);
  assert.equal(playbackTime(ranges, 9.5), null);
  assert.equal(cutTimeAt(ranges, 7), 3);
  assert.equal(cutTimeAt(ranges, 10), 5);
});

test("kept ranges are checked against the video and the length limits", () => {
  assert.equal(clipRangesProblem([{ start: 0, end: 8 }], 22.8, 3, 10), null);
  assert.match(clipRangesProblem([{ start: 0, end: 12 }], 22.8, 3, 10) ?? "", /at most 10 seconds/);
  assert.match(clipRangesProblem([{ start: 0, end: 2 }], 22.8, 3, 10) ?? "", /at least 3 seconds/);
  assert.match(clipRangesProblem([{ start: 5, end: 8 }, { start: 4, end: 6 }], 22.8, 3, 10) ?? "", /overlap/);
  assert.match(clipRangesProblem([{ start: 20, end: 30 }], 22.8, 3, 10) ?? "", /past the end/);
  assert.match(clipRangesProblem([], 22.8, 3, 10) ?? "", /Keep at least part/);
});

test("times read as minutes and tenths", () => {
  assert.equal(clipClock(7.44), "0:07.4");
  assert.equal(clipClock(83.2), "1:23.2");
});
