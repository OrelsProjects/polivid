import assert from "node:assert/strict";
import test from "node:test";
import { buildCaptionedTimeline, buildLoopTimeline, buildStillsTimeline } from "@/lib/video/compose/timeline";
import { focusPosition, highlightParts, insideRegion, regionBoxStyle, textBoxStyle } from "./layout-box";
import { defaultTextStyle, TimelineSchema } from "./schema";

test("a timeline saved before regions existed parses to exactly itself", () => {
  const saved = [
    buildStillsTimeline({
      jobId: "00000000-0000-4000-8000-000000000001",
      format: "9:16",
      beats: [{ imageKey: "uploads/u/a.png", say: "One line, said.", seconds: 2.5, pause: 0.5 }],
      captions: true,
    }),
    buildLoopTimeline({
      jobId: "00000000-0000-4000-8000-000000000001",
      format: "1:1",
      beats: [{ say: "Over a loop.", seconds: 3 }],
      captions: true,
      background: { source: { type: "library", id: "aurora" }, seconds: 9, name: "Aurora" },
    }),
    buildCaptionedTimeline({ format: "16:9", videoKey: "uploads/u/v.mp4", seconds: 4, lines: [{ text: "Hi", start: 0, end: 1 }] }),
  ];
  for (const timeline of saved) {
    const json = JSON.parse(JSON.stringify(timeline));
    assert.deepEqual(TimelineSchema.parse(json), json);
  }
});

test("a layer with no region or radius keeps its old full-frame box", () => {
  assert.equal(regionBoxStyle({}, { width: 1080, height: 1920 }), null);
  assert.equal(focusPosition(undefined), undefined);
});

test("a region is placed in frame percent, and its radius stays round on a non-square frame", () => {
  // A square bubble on a 9:16 frame: 30% of the width is 324px, which is 16.875% of the height.
  const style = regionBoxStyle({ region: { x: 64, y: 72, w: 30, h: 16.875 }, radius: 50 }, { width: 1080, height: 1920 });
  assert.ok(style);
  assert.equal(style.left, "64%");
  assert.equal(style.top, "72%");
  assert.equal(style.borderRadius, "50% / 50%");
  const wide = regionBoxStyle({ radius: 10 }, { width: 1080, height: 1920 });
  // 10% of the short side is 108px: 10% of the width, 5.625% of the height.
  assert.equal(wide?.borderRadius, "10% / 5.625%");
});

test("a box inside a region maps to frame percent", () => {
  assert.deepEqual(insideRegion({ x: 0, y: 50, w: 100, h: 50 }, { left: 0, top: 0, width: 100, height: 100 }), {
    left: 0,
    top: 50,
    width: 100,
    height: 50,
  });
  assert.deepEqual(insideRegion(undefined, { left: 10, top: 20, width: 30, height: 40 }), { left: 10, top: 20, width: 30, height: 40 });
});

test("text keeps its old look unless a new style is set", () => {
  const plain = textBoxStyle(defaultTextStyle());
  assert.equal("textTransform" in plain, false);
  assert.equal("borderRadius" in plain, false);
  assert.equal("WebkitTextStroke" in plain, false);
  const styled = textBoxStyle({ ...defaultTextStyle(), uppercase: true, radius: 999, outline: { color: "#000", width: 6 } });
  assert.equal(styled.textTransform, "uppercase");
  assert.equal(styled.borderRadius, 999);
  assert.equal(styled.WebkitTextStroke, "6px #000");
});

test("one word is highlighted, whatever its case, and a missing word leaves the text whole", () => {
  assert.deepEqual(highlightParts("Stop counting likes now", { text: "LIKES", color: "#FFD400" }), [
    { text: "Stop counting ", color: null },
    { text: "likes", color: "#FFD400" },
    { text: " now", color: null },
  ]);
  assert.deepEqual(highlightParts("Nothing here", { text: "likes", color: "#FFD400" }), [{ text: "Nothing here", color: null }]);
});
