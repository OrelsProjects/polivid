import assert from "node:assert/strict";
import test from "node:test";
import { continuationPrompt, smoothTransitionsApply, usesSmoothTransitions } from "./transitions";

test("smooth transitions apply to videos stitched from clips, but not lyrics or single clips", () => {
  for (const mode of ["prompt", "voiceover", "image", "shorts", "skit"]) assert.ok(smoothTransitionsApply(mode), mode);
  for (const mode of ["lyrics", "avatar", "ugc", "swap", "captions", null]) assert.equal(smoothTransitionsApply(mode), false, String(mode));
});

test("every multi-clip video runs on from shot to shot unless asked not to, skits included", () => {
  assert.equal(usesSmoothTransitions("skit", undefined), true);
  assert.equal(usesSmoothTransitions("skit", false), false);
  assert.equal(usesSmoothTransitions("prompt", undefined), true);
  assert.equal(usesSmoothTransitions("prompt", false), false);
  assert.equal(usesSmoothTransitions("avatar", true), false, "one clip has nothing to run on from");
});

test("a continuation starts exactly on the last frame, gets to the new scene without a cut, then films the shot as written", () => {
  const shot = "One continuous shot.\nAction: Quill slips on a stack of drafts";
  const prompt = continuationPrompt(shot);
  assert.match(prompt, /very last frame of the previous shot/);
  assert.match(prompt, /Start exactly on that frame/);
  assert.match(prompt, /Never swap the scene in a single frame/);
  assert.ok(prompt.endsWith(shot), "the shot itself comes last, unchanged");
});
