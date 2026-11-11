import assert from "node:assert/strict";
import test from "node:test";
import { blocksChangeWhileFilming, isFilmingStatus } from "./filming-guard";

test("only a queued or running video blocks changes", () => {
  assert.equal(isFilmingStatus("queued"), true);
  assert.equal(isFilmingStatus("running"), true);
  assert.equal(isFilmingStatus("paused"), false);
  assert.equal(isFilmingStatus("succeeded"), false);
  assert.equal(isFilmingStatus("failed"), false);
  assert.equal(isFilmingStatus(null), false);
});

test("edits and new videos are blocked while filming, questions are not", () => {
  assert.equal(blocksChangeWhileFilming({ effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false }, category: "editor" }), true);
  assert.equal(blocksChangeWhileFilming({ effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true }, category: "make" }), true);
  assert.equal(blocksChangeWhileFilming({ effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false }, category: "editor" }), false);
  assert.equal(blocksChangeWhileFilming({ effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false }, category: "ask" }), false);
  assert.equal(blocksChangeWhileFilming({ effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false }, category: "navigate" }), false);
});
