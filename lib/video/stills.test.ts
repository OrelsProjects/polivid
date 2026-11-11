import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITIES } from "@/lib/production/capabilities/registry";
import { defaultImageCapability } from "@/lib/production/capabilities";
import {
  MAX_STILLS,
  MIN_STILLS,
  STILL_IMAGE_USD,
  captionChunks,
  countWords,
  isComposedModel,
  loopBeatCount,
  maxLengthForMedia,
  motionForStill,
  secondsForWords,
  splitScript,
  stillCountFor,
  stillsUseDraft,
} from "./stills";

const SCRIPT =
  "Sleep is not downtime. While you rest, your brain replays the day. It keeps what matters, and it lets the rest go. " +
  "That is why a hard problem often looks easier in the morning. So the next time you are stuck, stop. Go to bed.";

test("a video gets about one picture every five seconds, within limits", () => {
  assert.equal(stillCountFor(5), MIN_STILLS);
  assert.equal(stillCountFor(30), 6);
  assert.equal(stillCountFor(31), 7);
  assert.equal(stillCountFor(90), MAX_STILLS);
  assert.equal(stillCountFor(30, 2), 2, "never more pictures than words");
  assert.equal(stillCountFor(30, 0), 1);
});

test("a script is sized by reading pace", () => {
  assert.equal(countWords("  one two\n three  "), 3);
  assert.equal(countWords(""), 0);
  assert.equal(secondsForWords(75), 30);
  assert.equal(secondsForWords(76), 31);
  assert.equal(secondsForWords(0), 0);
});

test("splitting keeps every word, in order, in exactly the parts asked for", () => {
  for (const count of [1, 2, 3, 5, 8]) {
    const beats = splitScript(SCRIPT, count);
    assert.equal(beats.length, count);
    assert.equal(beats.join(" "), SCRIPT.trim().split(/\s+/).join(" "));
    assert.ok(beats.every((beat) => beat.trim().length > 0));
  }
  assert.deepEqual(splitScript("", 4), []);
  assert.deepEqual(splitScript("one two", 5), ["one", "two"]);
});

test("cuts land on the end of a sentence when one is close", () => {
  const beats = splitScript(SCRIPT, 3);
  for (const beat of beats.slice(0, -1)) assert.match(beat, /[.!?]$/, beat);
});

test("a sentence with no pause is still cut", () => {
  const run = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
  const beats = splitScript(run, 4);
  assert.equal(beats.length, 4);
  assert.ok(beats.every((beat) => beat.split(" ").length === 10));
});

test("caption lines are short, in order, and fill the beat without overlapping", () => {
  const text = "While you rest, your brain replays the day and keeps what matters.";
  const chunks = captionChunks(text, 120);
  assert.equal(chunks.map((chunk) => chunk.text).join(" "), text);
  assert.ok(chunks.every((chunk) => chunk.text.split(" ").length <= 5));
  assert.equal(chunks[0]?.from, 0);
  for (let index = 1; index < chunks.length; index += 1) {
    const before = chunks[index - 1];
    assert.equal(chunks[index]?.from, (before?.from ?? 0) + (before?.frames ?? 0));
  }
  const last = chunks.at(-1);
  assert.equal((last?.from ?? 0) + (last?.frames ?? 0), 120);
  assert.deepEqual(captionChunks("", 30), []);
});

test("captions survive a beat too short to give every line a frame", () => {
  const chunks = captionChunks("one two three four five six seven eight nine ten", 2);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.frames >= 1));
  assert.equal(chunks.map((chunk) => chunk.text).join(" "), "one two three four five six seven eight nine ten");
});

test("neighbouring pictures never move the same way", () => {
  for (let index = 0; index < 12; index += 1) {
    assert.notEqual(motionForStill(index), motionForStill(index + 1));
  }
});

test("only Low draws draft pictures, and the prices match the image models", () => {
  assert.equal(stillsUseDraft("low"), true);
  assert.equal(stillsUseDraft("pro"), false);
  assert.equal(stillsUseDraft("ultra"), false);
  assert.equal(stillsUseDraft(undefined), false);
  const price = (final: boolean) => {
    const capability = CAPABILITIES.find((entry) => entry.modelId === defaultImageCapability(final).modelId);
    assert.ok(capability);
    assert.equal(capability.pricing.unit, "image");
    return capability.pricing.usd;
  };
  assert.equal(STILL_IMAGE_USD.draft, price(false));
  assert.equal(STILL_IMAGE_USD.final, price(true));
});

test("each kind of picture has its own length cap, and a loop is cut into short caption runs", () => {
  assert.equal(maxLengthForMedia("video"), 90);
  assert.equal(maxLengthForMedia("stills"), 90);
  assert.equal(maxLengthForMedia("loop"), 180);
  assert.equal(maxLengthForMedia(undefined), 90);
  assert.equal(loopBeatCount(0), 1);
  assert.equal(loopBeatCount(18), 1);
  assert.equal(loopBeatCount(19), 2);
  assert.equal(loopBeatCount(450), 25);
  assert.equal(isComposedModel("stills"), true);
  assert.equal(isComposedModel("loop"), true);
  assert.equal(isComposedModel("alibaba/wan-3.0"), false);
});
