import assert from "node:assert/strict";
import test from "node:test";
import { cloneProductionSettings } from "./clone";

test("regenerate clones settings onto a new preview production", () => {
  const cloned = cloneProductionSettings({
    title: "The letter",
    mode: "review",
    creativeDelegation: false,
    plannerProvider: "claude",
    budgetUsd: 15,
    format: "9:16",
    targetDurationSec: 30,
  });
  assert.deepEqual(cloned, {
    title: "The letter",
    status: "preview",
    stage: "preview",
    mode: "review",
    creativeDelegation: false,
    plannerProvider: "claude",
    budgetUsd: 15,
    format: "9:16",
    targetDurationSec: 30,
  });
  assert.equal("editProjectId" in cloned, false);
  assert.equal("spentUsd" in cloned, false);
});
