import assert from "node:assert/strict";
import test from "node:test";
import { applyPlanningProgress, generationItems, planningItemsFromKey, planningItemsFromStage } from "./progress";

test("planning items mark earlier steps done and later steps pending", () => {
  const items = planningItemsFromKey("develop", "active");
  assert.equal(items.find((item) => item.key === "save")?.state, "done");
  assert.equal(items.find((item) => item.key === "develop")?.state, "active");
  assert.equal(items.find((item) => item.key === "structure")?.state, "pending");
});

test("progress events keep completed steps done", () => {
  const started = applyPlanningProgress(planningItemsFromKey("save", "active"), {
    key: "develop",
    label: "Writing the script",
    state: "active",
  });
  const checked = applyPlanningProgress(started, {
    key: "check",
    label: "Checking the story",
    state: "done",
  });
  assert.equal(checked.find((item) => item.key === "develop")?.state, "done");
  assert.equal(checked.find((item) => item.key === "check")?.state, "done");
  assert.equal(checked.find((item) => item.key === "structure")?.state, "pending");
});

test("awaiting answers rewrites the last planning step", () => {
  const items = planningItemsFromStage("develop", "awaiting_answers");
  const ready = items.find((item) => item.key === "ready");
  assert.equal(ready?.label, "Waiting on a few choices");
  assert.equal(ready?.state, "active");
});

test("generation items group jobs and count completed ones", () => {
  const items = generationItems([
    { kind: "reference_image", status: "succeeded" },
    { kind: "reference_image", status: "leased" },
    { kind: "speech", status: "pending" },
    { kind: "shot_video", status: "leased" },
    { kind: "shot_video", status: "waiting_provider" },
    { kind: "shot_video", status: "pending" },
  ]);
  assert.equal(items[0]?.detail, "1/2 · 1 running");
  assert.equal(items[0]?.state, "active");
  assert.equal(items[1]?.state, "pending");
  assert.equal(items[2]?.label, "Generating video");
  assert.equal(items[2]?.detail, "0/3 · 2 generating");
  assert.equal(items[2]?.state, "active");
});
