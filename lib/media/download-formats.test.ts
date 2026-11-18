import assert from "node:assert/strict";
import test from "node:test";
import { downloadName, encodeWavChannels, gifPlan, MAX_GIF_SECONDS } from "./download-formats";

test("file names come from the title, with the right extension", () => {
  assert.equal(downloadName("Replace the monkey with Oshri", "gif"), "Replace the monkey with Oshri.gif");
  assert.equal(downloadName('a/b:c*"d', "wav"), "abcd.wav");
  assert.equal(downloadName("clip.mp4", "gif"), "clip.gif");
  assert.equal(downloadName("   ", "mp4"), "video.mp4");
});

test("a GIF is at most 480 wide, slower for longer clips, and stops at 30 seconds", () => {
  const short = gifPlan(7, 1080, 1920);
  assert.deepEqual([short.width, short.height, short.fps, short.frames, short.trimmed], [270, 480, 12, 84, false]);
  assert.equal(short.delayMs, 80);
  const longer = gifPlan(22.8, 720, 1280);
  assert.deepEqual([longer.width, longer.height, longer.fps], [202, 360, 8]);
  const tooLong = gifPlan(95, 1280, 720);
  assert.equal(tooLong.seconds, MAX_GIF_SECONDS);
  assert.equal(tooLong.trimmed, true);
  // Small videos are never scaled up.
  assert.deepEqual([gifPlan(5, 320, 240).width, gifPlan(5, 320, 240).height], [320, 240]);
});

test("a stereo WAV interleaves its channels behind a correct header", () => {
  const left = new Float32Array([0, 1, -1]);
  const right = new Float32Array([0.5, -0.5, 0]);
  const wav = encodeWavChannels([left, right], 44100);
  const view = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 44100 * 4);
  assert.equal(view.getUint32(40, true), 3 * 2 * 2);
  assert.equal(wav.length, 44 + 12);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((index) => view.getInt16(44 + index * 2, true)),
    [0, 16383, 32767, -16384, -32768, 0],
  );
});
