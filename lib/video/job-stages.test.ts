import assert from "node:assert/strict";
import test from "node:test";
import {
  clipCountForJob,
  clipProgressLabel,
  completedClipCount,
  filmingClipIndex,
  shouldHoldAfterClip,
  stageState,
  stagesForJob,
  visibleStages,
} from "./job-stages";

test("a long prompt video expects filming and stitching", () => {
  const job = { mode: "prompt", tier: "pro", model: "minimax/hailuo-3", length: 90 };
  assert.deepEqual(stagesForJob(job), ["script", "videos", "render", "finalize"]);
  assert.ok(clipCountForJob(job) > 1);
});

test("a prompt shot plan films one clip per cut", () => {
  const job = {
    mode: "prompt",
    tier: "pro",
    model: "minimax/hailuo-3",
    length: 10,
    cuts: [{ seconds: 1 }, { seconds: 1 }, { seconds: 8 }],
  };
  assert.equal(clipCountForJob(job), 3);
  assert.deepEqual(stagesForJob(job), ["script", "videos", "render", "finalize"]);
});

test("a single clip skips stitching", () => {
  const job = { mode: "prompt", tier: "low", model: "alibaba/wan-3.0", length: 8 };
  assert.deepEqual(stagesForJob(job), ["script", "videos", "finalize"]);
  assert.equal(clipCountForJob(job), 1);
});

test("motion graphics skips filming", () => {
  assert.deepEqual(stagesForJob({ mode: "motion-graphics", tier: "ultra", model: "anthropic/claude-opus-5.5", length: 30 }), [
    "script",
    "images",
    "finalize",
  ]);
  assert.deepEqual(stagesForJob({ mode: "motion-graphics", tier: "pro", model: "anthropic/claude-opus-5.5", length: 30 }), [
    "script",
    "finalize",
  ]);
});

test("an edit export only renders and finishes", () => {
  assert.deepEqual(stagesForJob({ mode: "editor-export", tier: "", model: "editor", length: 12 }), ["render", "finalize"]);
});

test("marks the live stage and the ones still expected", () => {
  const stages = ["script", "videos", "render", "finalize"] as const;
  assert.equal(stageState("script", stages, "videos"), "done");
  assert.equal(stageState("videos", stages, "videos"), "current");
  assert.equal(stageState("render", stages, "videos"), "upcoming");
  assert.equal(stageState("finalize", stages, null), "upcoming");
});

test("names the clip that is filming", () => {
  assert.equal(filmingClipIndex([], 13), 1);
  assert.equal(filmingClipIndex([{ sceneIdx: 6, status: "in_progress" }], 13), 7);
  assert.equal(
    filmingClipIndex(
      [
        { sceneIdx: 0, status: "completed" },
        { sceneIdx: 1, status: "completed" },
        { sceneIdx: 2, status: "completed" },
      ],
      13,
    ),
    4,
  );
  assert.equal(filmingClipIndex([{ sceneIdx: 0, status: "completed" }], 1), null);
  assert.equal(clipProgressLabel(7, 13), "Clip 7 of 13");
  assert.equal(clipProgressLabel(null, 13), "13 clips");
  assert.equal(clipProgressLabel(null, 13, { done: 4 }), "4 of 13 clips filmed");
  assert.equal(clipProgressLabel(null, 13, {}), "13 clips");
});

test("holds after the open clip, and lets the last clip finish the video", () => {
  assert.equal(shouldHoldAfterClip(6, 13, true), true);
  assert.equal(shouldHoldAfterClip(12, 13, true), false);
  assert.equal(shouldHoldAfterClip(6, 13, false), false);
  assert.equal(
    completedClipCount([
      { sceneIdx: 0, status: "completed" },
      { sceneIdx: 1, status: "completed" },
      { sceneIdx: 1, status: "completed" },
      { sceneIdx: 2, status: "in_progress" },
    ]),
    2,
  );
});

test("keeps a live step that the usual path skips", () => {
  assert.deepEqual(visibleStages(["script", "finalize"], "images"), ["script", "images", "finalize"]);
});
