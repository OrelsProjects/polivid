import assert from "node:assert/strict";
import test from "node:test";
import { describeClipSound, spokenFromArtifacts } from "./clip-sound";

test("an older mix replaced the footage sound and can only be silenced", () => {
  const sound = describeClipSound({
    found: true,
    mode: "prompt",
    hasVoice: true,
    spoken: "Orel runs for the hatch.",
  });
  assert.equal(sound.kind, "mixed");
  assert.match(sound.note, /replaced the original sound/);
  assert.match(sound.note, /volume to 0/);
  assert.equal(sound.spoken, "Orel runs for the hatch.");
});

test("a stored voice layer is its own clip", () => {
  const sound = describeClipSound({
    found: true,
    mode: "prompt",
    hasVoice: true,
    layered: true,
    spoken: "Orel runs for the hatch.",
  });
  assert.equal(sound.kind, "layer");
  assert.match(sound.note, /Voiceover clip/);
  assert.match(sound.note, /edit_remove/);
});

test("footage with no character keeps the model's own sound", () => {
  const sound = describeClipSound({ found: true, mode: "prompt", hasVoice: false, spoken: "" });
  assert.equal(sound.kind, "model");
  assert.match(sound.note, /No voice was added/);
});

test("a character without a saved script was not mixed", () => {
  const sound = describeClipSound({ found: true, mode: "prompt", hasVoice: true, spoken: "  " });
  assert.equal(sound.kind, "model");
});

test("a lyrics video is the song, even when a character sang it", () => {
  const sound = describeClipSound({ found: true, mode: "lyrics", hasVoice: true, spoken: "la la" });
  assert.equal(sound.kind, "song");
});

test("a project with no filmed job does not invent a mix", () => {
  assert.equal(describeClipSound({ found: false, hasVoice: false }).kind, "unknown");
});

test("spoken text is read from job artifacts", () => {
  assert.equal(spokenFromArtifacts({ spoken: " Hello " }), "Hello");
  assert.equal(spokenFromArtifacts(null), "");
  assert.equal(spokenFromArtifacts({ spoken: 4 }), "");
});
