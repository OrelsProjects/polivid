import assert from "node:assert/strict";
import test from "node:test";
import { LYRICS_INPUTS } from "./lyrics-inputs";

test("every lyrics input shows an example and a fill-in prompt", () => {
  for (const input of Object.values(LYRICS_INPUTS)) {
    assert.match(input.placeholder, /Example/);
    assert.match(input.template, /\[explain_here\]/);
    assert.ok(input.label.length > 0);
  }
});
