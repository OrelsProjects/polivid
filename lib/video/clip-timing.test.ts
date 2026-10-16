import assert from "node:assert/strict";
import test from "node:test";
import { clipFinishData, clipStartData } from "./clip-timing";

test("a new clip records the model and the moment the provider accepted it", () => {
  const now = new Date("2026-10-16T07:07:50.000Z");
  assert.deepEqual(clipStartData(" minimax/hailuo-3 ", now), {
    status: "in_progress",
    model: "minimax/hailuo-3",
    startedAt: now,
  });
  assert.equal(clipStartData("  ", now).model, null);
});

test("finishing a clip keeps the original start and fills a missing model", () => {
  const createdAt = new Date("2026-10-16T07:07:50.000Z");
  const now = new Date("2026-10-16T07:23:48.000Z");
  const first = clipFinishData(
    { startedAt: null, createdAt, model: null, finishedAt: null },
    "completed",
    "minimax/hailuo-3",
    now,
  );
  assert.deepEqual(first, {
    status: "completed",
    lastPolledAt: now,
    finishedAt: now,
    startedAt: createdAt,
    model: "minimax/hailuo-3",
  });

  const again = clipFinishData(
    { startedAt: createdAt, createdAt, model: "minimax/hailuo-3", finishedAt: now },
    "failed",
    "other/model",
    new Date("2026-10-16T08:00:00.000Z"),
  );
  assert.equal(again, null);
});
