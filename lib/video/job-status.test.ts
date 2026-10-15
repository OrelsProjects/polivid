import assert from "node:assert/strict";
import test from "node:test";
import { assertJobTransition, JobTransitionError, progressFor, readJobInput, stepIsComplete } from "./job-status";

test("allows the legal video job moves", () => {
  assert.doesNotThrow(() => assertJobTransition("queued", "running"));
  assert.doesNotThrow(() => assertJobTransition("queued", "canceled"));
  assert.doesNotThrow(() => assertJobTransition("running", "succeeded"));
  assert.doesNotThrow(() => assertJobTransition("running", "failed"));
  assert.doesNotThrow(() => assertJobTransition("running", "canceled"));
});

test("rejects illegal video job moves", () => {
  const illegal: Array<[Parameters<typeof assertJobTransition>[0], Parameters<typeof assertJobTransition>[1]]> = [
    ["queued", "succeeded"],
    ["queued", "failed"],
    ["running", "queued"],
    ["succeeded", "running"],
    ["succeeded", "failed"],
    ["failed", "queued"],
    ["failed", "canceled"],
    ["canceled", "running"],
  ];
  for (const [from, to] of illegal) {
    assert.throws(() => assertJobTransition(from, to), JobTransitionError);
  }
});

test("reads the prompt stored on a video job", () => {
  assert.deepEqual(
    readJobInput({
      prompt: "A man walking down Paris",
      aspectRatio: "9:16",
      duration: 5,
      model: "alibaba/wan-3.0",
    }),
    {
      prompt: "A man walking down Paris",
      format: "9:16",
      length: 5,
      model: "alibaba/wan-3.0",
      mode: "",
      tier: "",
      resolution: "",
      imageKey: "",
      mediaKey: "",
      referenceKeys: [],
      showText: true,
      projectId: "",
    },
  );
  assert.deepEqual(readJobInput(null), {
    prompt: "Untitled video",
    format: "9:16",
    length: 0,
    model: "",
    mode: "",
    tier: "",
    resolution: "",
    imageKey: "",
    mediaKey: "",
    referenceKeys: [],
    showText: true,
    projectId: "",
  });
  assert.equal(readJobInput({ prompt: "  ", aspectRatio: "square", duration: 1.5 }).format, "9:16");
  assert.deepEqual(
    readJobInput({
      prompt: "A man walking down Paris",
      aspectRatio: "9:16",
      duration: 5,
      model: "bytedance/seedance-2.5",
      referenceKey: "uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
    }).referenceKeys,
    ["uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"],
  );
  assert.deepEqual(
    readJobInput({
      prompt: "A man walking down Paris",
      aspectRatio: "9:16",
      duration: 5,
      model: "bytedance/seedance-2.5",
      referenceKeys: [
        "uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
        "uploads/user_abc/ffffffff-1111-2222-3333-444444444444.png",
      ],
    }).referenceKeys,
    [
      "uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
      "uploads/user_abc/ffffffff-1111-2222-3333-444444444444.png",
    ],
  );
});

test("reads showText off from a stored job", () => {
  assert.equal(
    readJobInput({
      prompt: "A man walking down Paris",
      aspectRatio: "9:16",
      duration: 5,
      model: "alibaba/wan-3.0",
      showText: false,
    }).showText,
    false,
  );
});

test("a skipped step stays incomplete until progress enters the next band", () => {
  assert.equal(stepIsComplete("script", "videos", 39), false);
  assert.equal(stepIsComplete("images", "videos", 39), false);
  assert.equal(stepIsComplete("script", "images", 40), true);
  assert.equal(stepIsComplete("images", "videos", 40), true);
  assert.equal(stepIsComplete("videos", "videos", 50), false);
});

test("video progress stays inside the step bands", () => {
  assert.equal(progressFor("script"), 10);
  assert.equal(progressFor("images"), 40);
  assert.equal(progressFor("videos", 0, 4), 40);
  assert.equal(progressFor("videos", 2, 4), 63);
  assert.equal(progressFor("videos", 4, 4), 85);
  assert.equal(progressFor("render"), 98);
  assert.equal(progressFor("finalize"), 100);
});
