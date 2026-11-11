import assert from "node:assert/strict";
import test from "node:test";
import {
  fallbackBeats,
  narrationSource,
  trimToWords,
  voiceBeatTimings,
  voiceBeatTotal,
  voiceoverDeclined,
  wordsForSeconds,
} from "./beat-text";

test("later fallback beats do not repeat the whole prompt", () => {
  const beats = fallbackBeats("Orel sprints, then dives, then the door seals", [4, 3, 3]);
  assert.equal(beats.length, 3);
  assert.equal(beats[0], "Orel sprints, then dives, then the door seals");
  assert.match(beats[1] ?? "", /Do not replay earlier events/);
  assert.match(beats[2] ?? "", /Do not replay earlier events/);
  assert.doesNotMatch(beats[1] ?? "", /Orel sprints, then dives/);
  assert.doesNotMatch(beats[2] ?? "", /Orel sprints, then dives/);
});

test("spoken beats add up to the filmed clips", () => {
  const timings = voiceBeatTimings(["Run", "Dive", "The door seals"], [4, 3, 3], 10);
  assert.equal(timings.length, 3);
  assert.equal(voiceBeatTotal(timings), 10);
  assert.deepEqual(
    timings.map((beat) => beat.seconds),
    [4, 3, 3],
  );
});

test("a spoken beat is trimmed to the clip length", () => {
  assert.equal(wordsForSeconds(4), 10);
  assert.equal(trimToWords("one two three four five", 3), "one two three");
  assert.equal(voiceoverDeclined("none"), true);
  assert.equal(voiceoverDeclined(""), true);
  assert.equal(voiceoverDeclined(undefined), false);
  assert.equal(voiceoverDeclined("Run, then the door seals"), false);
  assert.equal(narrationSource({ mode: "prompt", vo: "none", prompt: "A chase" }), null);
  assert.equal(narrationSource({ mode: "prompt", vo: "", prompt: "A chase" }), null);
  assert.equal(
    narrationSource({
      mode: "prompt",
      prompt: "No spoken lines. A chase",
      actions: ["Orel sprints", "The door seals"],
    }),
    "Orel sprints\nThe door seals",
  );
  assert.equal(
    narrationSource({ mode: "prompt", vo: "Run for the hatch\nThe door seals", prompt: "A chase" }),
    "Run for the hatch\nThe door seals",
  );
  assert.equal(
    narrationSource({ mode: "voiceover", prompt: "Read this", voiceover: "Read this aloud" }),
    "Read this aloud",
  );
});
