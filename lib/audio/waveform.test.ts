import assert from "node:assert/strict";
import test from "node:test";
import { analyzeWaveform } from "./waveform";

const RATE = 8000;

/** One second loud, a 0.6s linear fade, then 0.4s of silence — the shape of a generated song's ending. */
const fadingSong = () => {
  const samples = new Float32Array(RATE * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / RATE;
    const gain = time < 1 ? 1 : time < 1.6 ? 1 - (time - 1) / 0.6 : 0;
    samples[index] = gain * Math.sin(2 * Math.PI * 220 * time);
  }
  return samples;
};

test("a song ends where its fade drops out of hearing, not at the end of the file", () => {
  const waveform = analyzeWaveform([fadingSong()], RATE, 40);
  assert.ok(waveform);
  assert.equal(waveform.duration, 2);
  // 20 dB below full level is a tenth of the amplitude, 0.54s into the fade.
  assert.ok(waveform.audibleEnd > 1.5 && waveform.audibleEnd < 1.58, `audible end ${waveform.audibleEnd}`);
});

test("the waveform covers only the audible part and shows the fade", () => {
  const waveform = analyzeWaveform([fadingSong()], RATE, 40);
  assert.ok(waveform);
  assert.equal(waveform.bars.length, 40);
  assert.ok(waveform.bars.every((height) => height >= 0.12 && height <= 1));
  assert.ok(waveform.bars[0] > 0.95);
  assert.ok(waveform.bars[39] < waveform.bars[0] * 0.6);
});

test("silence and empty audio don't cut the track short", () => {
  const silent = analyzeWaveform([new Float32Array(RATE)], RATE, 10);
  assert.ok(silent);
  assert.equal(silent.audibleEnd, 1);
  assert.equal(analyzeWaveform([new Float32Array(0)], RATE, 10), null);
});
