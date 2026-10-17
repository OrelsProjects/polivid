import assert from "node:assert/strict";
import test from "node:test";
import { currentExportVideoId, nextExportMark } from "./export-mark";

test("a finished export is current only when the saved version matches", () => {
  const mark = { videoId: "video-1", version: 4 };
  assert.equal(currentExportVideoId(mark, 4, true), "video-1");
  assert.equal(currentExportVideoId(mark, 4, false), null);
  assert.equal(currentExportVideoId(mark, 5, true), null);
  assert.equal(currentExportVideoId({ videoId: null, version: null }, 1, true), null);
});

test("a newer export replaces an older one, and an older write does not", () => {
  assert.deepEqual(nextExportMark({ version: null }, { videoId: "a", version: 2 }), { videoId: "a", version: 2 });
  assert.deepEqual(nextExportMark({ version: 2 }, { videoId: "b", version: 2 }), { videoId: "b", version: 2 });
  assert.deepEqual(nextExportMark({ version: 2 }, { videoId: "c", version: 3 }), { videoId: "c", version: 3 });
  assert.equal(nextExportMark({ version: 3 }, { videoId: "d", version: 2 }), null);
});
