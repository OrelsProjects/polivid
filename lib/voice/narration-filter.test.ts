import assert from "node:assert/strict";
import test from "node:test";
import { fitNarrationArgs, mixAudioArgs, mixAudioFilter, pausedNarrationArgs, replaceAudioArgs } from "./narration-filter";

test("a mix keeps the footage audio under the voice", () => {
  const filter = mixAudioFilter(10);
  assert.match(filter, /\[0:a\].*volume=0\.35/);
  assert.match(filter, /amix=inputs=2/);
  const args = mixAudioArgs("picture.mp4", "speech.mp3", "voiced.mp4", 10);
  assert.ok(args.includes(filter));
  assert.ok(args.includes("0:v:0"));
  assert.match(filter, /\[1:a\]/);
});

test("a clip with no audio falls back to replacing the stream", () => {
  const args = replaceAudioArgs("picture.mp4", "speech.mp3", "voiced.mp4", 10);
  const filter = args[args.indexOf("-filter_complex") + 1] ?? "";
  assert.match(filter, /\[1:a\]/);
  assert.equal(filter.includes("amix"), false);
  assert.equal(filter.includes("[0:a]"), false);
});

test("fitted narration is an mp3 the length of the picture", () => {
  const args = fitNarrationArgs("speech.mp3", "voice.mp3", 8);
  assert.ok(args.includes("libmp3lame"));
  assert.match(args.join(" "), /apad=whole_dur=8\.000,atrim=0:8\.000/);
  assert.equal(args.includes("0:v:0"), false);
});

test("a paused beat is padded with silence and keeps its own sample rate", () => {
  const args = pausedNarrationArgs("speech.mp3", "paused.mp3", 1.25);
  assert.ok(args.includes("apad=pad_dur=1.250"));
  assert.ok(!args.includes("-ar"), "the sample rate is left as it came, so beats still join");
  assert.equal(args.at(-1), "paused.mp3");
});
