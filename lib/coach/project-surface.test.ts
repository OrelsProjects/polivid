import assert from "node:assert/strict";
import test from "node:test";
import { isCoachProjectMode, visibleCoachProject } from "./project-surface";

const open = { id: "project-1", sourceVideoId: "video-1" };

test("no video and no project stays on the chat", () => {
  assert.equal(
    visibleCoachProject({ project: null, heldProject: null, activeJobId: null, jobStatus: null }),
    null,
  );
  assert.equal(isCoachProjectMode({ visibleProject: false, activeJobId: null, jobStatus: null }), false);
});

test("an open project stays up when nothing is filming", () => {
  assert.equal(
    visibleCoachProject({ project: open, heldProject: null, activeJobId: null, jobStatus: null }),
    open,
  );
  assert.equal(isCoachProjectMode({ visibleProject: true, activeJobId: null, jobStatus: null }), true);
});

test("a running job with no project shows the filming stage", () => {
  assert.equal(
    visibleCoachProject({ project: null, heldProject: null, activeJobId: "job-2", jobStatus: "running" }),
    null,
  );
  assert.equal(isCoachProjectMode({ visibleProject: false, activeJobId: "job-2", jobStatus: "running" }), true);
});

test("a running job covers a project from a different video", () => {
  assert.equal(
    visibleCoachProject({ project: open, heldProject: null, activeJobId: "job-2", jobStatus: "running" }),
    null,
  );
});

test("the project for this video stays open after it succeeds", () => {
  const ready = { id: "project-2", sourceVideoId: "video-2" };
  assert.equal(
    visibleCoachProject({ project: ready, heldProject: open, activeJobId: "video-2", jobStatus: "succeeded" }),
    ready,
  );
});

test("cancel with nothing behind the video returns to the chat", () => {
  assert.equal(
    visibleCoachProject({ project: null, heldProject: null, activeJobId: "job-2", jobStatus: "canceled" }),
    null,
  );
  assert.equal(isCoachProjectMode({ visibleProject: false, activeJobId: "job-2", jobStatus: "canceled" }), false);
});

test("cancel brings back the project the new video pushed aside", () => {
  assert.equal(
    visibleCoachProject({ project: null, heldProject: open, activeJobId: "job-2", jobStatus: "canceled" }),
    open,
  );
  assert.equal(isCoachProjectMode({ visibleProject: true, activeJobId: "job-2", jobStatus: "canceled" }), true);
});

test("cancel keeps a project that has not been cleared yet", () => {
  assert.equal(
    visibleCoachProject({ project: open, heldProject: null, activeJobId: "job-2", jobStatus: "canceled" }),
    open,
  );
});

test("a failed job stays on the filming stage", () => {
  assert.equal(isCoachProjectMode({ visibleProject: false, activeJobId: "job-2", jobStatus: "failed" }), true);
});
