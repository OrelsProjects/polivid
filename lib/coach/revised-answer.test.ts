import assert from "node:assert/strict";
import test from "node:test";
import { revisedAnswerMessage } from "./revised-answer";

test("an edited answer tells the Coach which question changed", () => {
  assert.equal(
    revisedAnswerMessage("Which story?", "The last pilot"),
    "Change my answer to “Which story?” to: The last pilot",
  );
});
