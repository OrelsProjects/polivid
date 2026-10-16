import assert from "node:assert/strict";
import test from "node:test";
import type { UIMessage } from "ai";
import { mergeCoachTurn } from "./merge-turn";

const message = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

test("mergeCoachTurn appends a new message", () => {
  const previous = [message("a", "hi")];
  const next = mergeCoachTurn(previous, message("b", "go"));
  assert.deepEqual(
    next.map((item) => item.id),
    ["a", "b"],
  );
});

test("mergeCoachTurn replaces an existing message instead of duplicating it", () => {
  const previous = [message("a", "hi"), message("b", "wait")];
  const updated = message("b", "approved");
  const next = mergeCoachTurn(previous, updated);
  assert.equal(next.length, 2);
  assert.equal(next[1]?.id, "b");
  assert.equal(next[1]?.parts[0]?.type === "text" ? next[1].parts[0].text : "", "approved");
});
