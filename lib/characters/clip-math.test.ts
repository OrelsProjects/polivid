import assert from "node:assert/strict";
import test from "node:test";
import { candidateTimes, encodeWav, laplacianVariance, loudShare, pickSharpSpaced, toGray } from "./clip-math";

test("a sharp checkerboard scores higher than a flat image", () => {
  const size = 16;
  const flat = new Array(size * size).fill(128);
  const checker = Array.from({ length: size * size }, (_, i) => ((Math.floor(i / size) + (i % size)) % 2 ? 255 : 0));
  assert.equal(laplacianVariance(flat, size, size), 0);
  assert.ok(laplacianVariance(checker, size, size) > 1000);
  assert.equal(laplacianVariance([1, 2], 2, 1), 0);
});

test("gray conversion weights green most", () => {
  const gray = toGray([255, 0, 0, 255, 0, 255, 0, 255]);
  assert.ok(gray[1] > gray[0]);
});

test("candidate times stay inside the clip", () => {
  const times = candidateTimes(10, 5);
  assert.equal(times.length, 5);
  assert.ok(times[0] > 0 && times.at(-1)! < 10);
  assert.deepEqual(candidateTimes(0, 5), []);
});

test("picks the sharpest frames that are far enough apart, in time order", () => {
  const picked = pickSharpSpaced(
    [
      { time: 1, score: 9 },
      { time: 1.2, score: 10 },
      { time: 5, score: 3 },
      { time: 8, score: 7 },
    ],
    3,
    1,
  );
  assert.deepEqual(picked.map((item) => item.time), [1.2, 5, 8]);
});

test("WAV header and length are right", () => {
  const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 22050);
  const text = (from: number) => String.fromCharCode(...wav.slice(from, from + 4));
  assert.equal(text(0), "RIFF");
  assert.equal(text(8), "WAVE");
  assert.equal(wav.byteLength, 44 + 8);
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 22050);
});

test("silence has no loud share", () => {
  assert.equal(loudShare(new Float32Array(100)), 0);
  assert.ok(loudShare(new Float32Array([0.5, 0.5, 0, 0])) === 0.5);
});
