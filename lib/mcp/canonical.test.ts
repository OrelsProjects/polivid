import assert from "node:assert/strict";
import test from "node:test";
import { callHash, canonicalJson, splitConfirmToken } from "./canonical";

test("canonical JSON ignores key order and undefined", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } }), '{"a":{"d":[1,{"x":1,"y":2}]},"b":1}');
  assert.equal(callHash("make_prompt_video", { a: 1, b: 2 }), callHash("make_prompt_video", { b: 2, a: 1 }));
});

test("a quote is bound to the tool and the exact input", () => {
  const input = { prompt: "a cat", length: 10 };
  assert.notEqual(callHash("make_prompt_video", input), callHash("make_shorts_video", input));
  assert.notEqual(callHash("make_prompt_video", input), callHash("make_prompt_video", { ...input, length: 11 }));
});

test("splitConfirmToken removes the token from the input", () => {
  const { input, confirmToken } = splitConfirmToken({ prompt: "x", confirmToken: " pvq_1 " });
  assert.deepEqual(input, { prompt: "x" });
  assert.equal(confirmToken, "pvq_1");
  assert.equal(callHash("t", input), callHash("t", { prompt: "x" }));
  assert.equal(splitConfirmToken(undefined).confirmToken, "");
});
