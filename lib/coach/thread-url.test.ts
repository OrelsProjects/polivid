import assert from "node:assert/strict";
import test from "node:test";
import { coachThreadHistoryState } from "./thread-url";

test("a missing history state still opts out of Next navigation", () => {
  assert.deepEqual(coachThreadHistoryState(null), { __NA: true });
  assert.deepEqual(coachThreadHistoryState(undefined), { __NA: true });
});

test("the current Next history entry is kept and marked as an internal write", () => {
  const state = coachThreadHistoryState({
    __NA: true,
    __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ["coach"] },
  });
  assert.equal(state.__NA, true);
  assert.deepEqual(state.__PRIVATE_NEXTJS_INTERNALS_TREE, { tree: ["coach"] });
});
