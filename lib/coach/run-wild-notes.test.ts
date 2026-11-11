import assert from "node:assert/strict";
import test from "node:test";
import {
  JUST_MAKE_IT_TEXT,
  RUN_WILD_NOTE,
  hasRunWildNote,
  proseWithoutRunWildNote,
  runWildFromMessages,
  runWildNote,
} from "./run-wild-notes";

test("a run wild note is one line and strips out of the prose", () => {
  assert.equal(runWildNote(), RUN_WILD_NOTE);
  assert.equal(hasRunWildNote(`Make the reel.\n${RUN_WILD_NOTE}`), true);
  assert.equal(proseWithoutRunWildNote(`Make the reel.\n${RUN_WILD_NOTE}`), "Make the reel.");
  assert.equal(hasRunWildNote("Make the reel."), false);
});

test("run wild follows the latest user message, or a Just make it answer", () => {
  const quiet = { role: "user", parts: [{ type: "text", text: "Make a movie." }] };
  const wild = { role: "user", parts: [{ type: "text", text: `Make a movie.\n${RUN_WILD_NOTE}` }] };
  const asked = {
    role: "assistant",
    parts: [{ type: "tool-app_ask_question", output: JUST_MAKE_IT_TEXT }],
  };
  const later = { role: "user", parts: [{ type: "text", text: "Make it blue." }] };

  assert.equal(runWildFromMessages([quiet]), false);
  assert.equal(runWildFromMessages([wild]), true);
  assert.equal(runWildFromMessages([quiet, asked]), true);
  assert.equal(runWildFromMessages([wild, later]), false);
  assert.equal(runWildFromMessages([{ role: "user", parts: [{ type: "text", text: JUST_MAKE_IT_TEXT }] }]), true);
});
