import assert from "node:assert/strict";
import test from "node:test";
import { FPS } from "@/lib/video/schema";
import { addTextEdit, captionLinesFromTranscript, readTimeline, removeEdit, splitEdit, trimEdit } from "./coach-edits";
import { addItem, createVideoItem } from "./operations";
import { emptyTimeline, type Asset } from "./schema";

const video = (): Asset => ({
  id: "asset-a",
  kind: "video",
  source: { type: "video", videoId: "video-a" },
  name: "Lighthouse",
  durationInFrames: 10 * FPS,
  width: null,
  height: null,
});

const withClip = () => {
  const asset = video();
  const timeline = addItem({ ...emptyTimeline("9:16"), assets: [asset] }, createVideoItem(asset, 0));
  const itemId = timeline.tracks[0]?.items[0]?.id;
  if (!itemId) throw new Error("missing clip");
  return { timeline, itemId };
};

test("a title lands at the requested time and position", () => {
  const { timeline } = withClip();
  const edited = addTextEdit(timeline, { text: "Dawn", startSec: 0, endSec: 3, position: "top" });
  const reading = readTimeline(edited.timeline);
  const text = reading.tracks.find((track) => track.kind === "text")?.items[0];
  assert.equal(text?.text, "Dawn");
  assert.equal(text?.startSec, 0);
  assert.equal(text?.endSec, 3);
  assert.deepEqual(edited.changedItemIds, [text?.id]);
});

test("trimming the end shortens the clip", () => {
  const { timeline, itemId } = withClip();
  const edited = trimEdit(timeline, { itemId, endSec: 8 });
  const item = readTimeline(edited.timeline).tracks[0]?.items[0];
  assert.equal(item?.endSec, 8);
});

test("splitting then removing drops the tail", () => {
  const { timeline, itemId } = withClip();
  const split = splitEdit(timeline, { itemId, atSec: 4 });
  assert.equal(split.changedItemIds.length, 2);
  const removed = removeEdit(split.timeline, { itemId: split.changedItemIds[1] ?? "" });
  const items = readTimeline(removed.timeline).tracks[0]?.items ?? [];
  assert.equal(items.length, 1);
  assert.equal(items[0]?.endSec, 4);
});

test("a transcript becomes short caption lines", () => {
  const lines = captionLinesFromTranscript("one two three four five six", 6);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.text, "one two three four");
  assert.equal(lines[1]?.startSec, 3);
  assert.equal(lines[1]?.endSec, 6);
});
