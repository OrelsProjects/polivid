import assert from "node:assert/strict";
import test from "node:test";
import {
  addItem,
  addTrack,
  deleteItem,
  duplicateItem,
  moveItem,
  rippleDelete,
  setCrossfade,
  setFormat,
  splitItem,
  trimItem,
} from "./operations";
import { emptyTimeline, type VideoItem } from "./schema";

const videoItem = (overrides: Partial<VideoItem> = {}): VideoItem => ({
  kind: "video",
  id: "clip-a",
  from: 0,
  durationInFrames: 90,
  transitionIn: null,
  transitionOut: null,
  assetId: "asset-a",
  trimStart: 0,
  volume: 1,
  transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: "cover" },
  opacity: 1,
  ...overrides,
});

const seeded = () => {
  const timeline = emptyTimeline("9:16");
  return addItem(
    {
      ...timeline,
      assets: [
        {
          id: "asset-a",
          kind: "video",
          source: { type: "video", videoId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
          name: "Clip",
          durationInFrames: 180,
          width: null,
          height: null,
        },
      ],
    },
    videoItem(),
    timeline.tracks[0].id,
  );
};

test("moves a clip on the same track", () => {
  const moved = moveItem(seeded(), "clip-a", 30);
  assert.equal(moved.tracks[0].items[0]?.from, 30);
});

test("trims the start and advances trimStart", () => {
  const trimmed = trimItem(seeded(), "clip-a", "start", 15);
  const item = trimmed.tracks[0].items[0];
  assert.equal(item?.from, 15);
  assert.equal(item?.durationInFrames, 75);
  assert.equal(item && "trimStart" in item ? item.trimStart : -1, 15);
});

test("splits a clip at a frame inside it", () => {
  const split = splitItem(seeded(), "clip-a", 30);
  assert.equal(split.tracks[0].items.length, 2);
  assert.equal(split.tracks[0].items[0]?.durationInFrames, 30);
  assert.equal(split.tracks[0].items[1]?.from, 30);
  assert.equal(split.tracks[0].items[1]?.durationInFrames, 60);
  assert.equal(split.tracks[0].items[1] && "trimStart" in split.tracks[0].items[1] ? split.tracks[0].items[1].trimStart : -1, 30);
});

test("deletes a clip", () => {
  const next = deleteItem(seeded(), "clip-a");
  assert.equal(next.tracks[0].items.length, 0);
});

test("duplicates a clip after the original", () => {
  const next = duplicateItem(seeded(), "clip-a");
  assert.equal(next.tracks[0].items.length, 2);
  assert.equal(next.tracks[0].items[1]?.from, 90);
});

test("ripple-deletes and closes the gap", () => {
  const withSecond = addItem(seeded(), videoItem({ id: "clip-b", from: 90, durationInFrames: 30 }));
  const next = rippleDelete(withSecond, "clip-a");
  assert.equal(next.tracks[0].items.length, 1);
  assert.equal(next.tracks[0].items[0]?.id, "clip-b");
  assert.equal(next.tracks[0].items[0]?.from, 0);
});

test("crossfades two adjacent clips", () => {
  const withSecond = addItem(seeded(), videoItem({ id: "clip-b", from: 90, durationInFrames: 60 }));
  const next = setCrossfade(withSecond, "clip-a", "clip-b", 10);
  const first = next.tracks[0].items.find((item) => item.id === "clip-a");
  const second = next.tracks[0].items.find((item) => item.id === "clip-b");
  assert.equal(first?.transitionOut?.type, "fade");
  assert.equal(first?.transitionOut?.durationInFrames, 10);
  assert.equal(second?.from, 80);
  assert.equal(second?.transitionIn?.type, "fade");
});

test("adds a track and changes format", () => {
  const withTrack = addTrack(seeded(), "visual", "B-roll");
  assert.equal(withTrack.tracks.length, 4);
  assert.equal(setFormat(withTrack, "16:9").format, "16:9");
});
