import assert from "node:assert/strict";
import test from "node:test";
import { hasFtyp, isFakeMp4, isSilentMockWav, toneWav } from "./placeholder-media";

test("mock video placeholders are not real mp4 files", () => {
  const fake = Uint8Array.from({ length: 1200 }, (_, i) => ("shot".charCodeAt(i % 4) + i) % 256);
  assert.equal(isFakeMp4(fake), true);
  assert.equal(hasFtyp(fake), false);
});

test("silent 8khz mock wavs are detected and replaced with a tone", () => {
  const silent = Uint8Array.from({ length: 44 + 8000 * 2 }, () => 0);
  const view = new DataView(silent.buffer);
  silent[0] = 82; silent[1] = 73; silent[2] = 70; silent[3] = 70;
  silent[8] = 87; silent[9] = 65; silent[10] = 86; silent[11] = 69;
  view.setUint32(24, 8000, true);
  assert.equal(isSilentMockWav(silent), true);
  const tone = toneWav(0.5, 440);
  assert.equal(isSilentMockWav(tone), false);
  const sample = new DataView(tone.buffer).getInt16(44 + 200, true);
  assert.ok(sample !== 0);
});
