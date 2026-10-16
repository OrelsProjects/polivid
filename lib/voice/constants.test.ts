import assert from "node:assert/strict";
import test from "node:test";
import {
  SAMPLE_PROMPTS,
  defaultCharacterForMode,
  defaultVoiceForMode,
  isCharacterId,
  isVoiceSettingId,
  modeCanNarrate,
  validateSamples,
} from "./constants";
import { narrationFilter } from "./narration-filter";

const sample = (size: number, type = "audio/webm", name = "line.webm") => ({ size, type, name });

test("a voice recording needs every part, and each part has to be real audio", () => {
  const full = () => SAMPLE_PROMPTS.map(() => sample(8_000));
  const withPart = (index: number, part: ReturnType<typeof sample>) => full().map((item, at) => (at === index ? part : item));
  assert.equal(validateSamples([sample(8_000), sample(8_000)]), `Record all ${SAMPLE_PROMPTS.length} parts.`);
  assert.equal(validateSamples(withPart(1, sample(8_000, "text/plain", "note.txt"))), "Part 2 needs to be an audio recording.");
  assert.equal(validateSamples(withPart(0, sample(100))), "Part 1 is too short. Record the whole part.");
  assert.equal(validateSamples(full()), null);
  assert.equal(validateSamples(withPart(0, sample(8_000, "", "take.mp3"))), null);
});

test("the recording includes singing, so songs can sound like the speaker", () => {
  assert.ok(SAMPLE_PROMPTS.some((prompt) => prompt.kind === "sing"));
  const minimumSeconds = SAMPLE_PROMPTS.reduce((total, prompt) => total + prompt.minSeconds, 0);
  assert.ok(minimumSeconds >= 50);
});

test("voiceover starts on the studio narrator, and music keeps its own audio", () => {
  assert.equal(defaultVoiceForMode("voiceover"), "studio");
  assert.equal(defaultVoiceForMode("prompt"), "off");
  assert.equal(modeCanNarrate("voiceover"), true);
  assert.equal(modeCanNarrate("image"), true);
  assert.equal(modeCanNarrate("lyrics"), true);
  assert.equal(modeCanNarrate(undefined), true);
  assert.equal(modeCanNarrate("music"), false);
  assert.equal(modeCanNarrate("avatar"), false);
  assert.equal(isVoiceSettingId("studio"), true);
  assert.equal(isVoiceSettingId("off"), true);
  assert.equal(isVoiceSettingId("11111111-2222-3333-4444-555555555555"), true);
  assert.equal(isVoiceSettingId("maya"), false);
  assert.equal(isCharacterId("studio"), true);
  assert.equal(defaultCharacterForMode("voiceover"), "studio");
});

test("narration is padded to the picture length", () => {
  assert.match(narrationFilter(12), /apad=whole_dur=12\.000,atrim=0:12\.000/);
});
