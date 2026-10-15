import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { probeFile } from "./ffmpeg";
import { captureBoundaryFrames, extractLastFrame, sampleFrames } from "./frames";

const execFileAsync = promisify(execFile);

/** A 2 second, 10 fps clip whose frames carry a visible counter so the last one is distinguishable. */
const syntheticClip = async (dir: string) => {
  const file = path.join(dir, "clip.mp4");
  await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=2", "-pix_fmt", "yuv420p", file]);
  return new Uint8Array(await readFile(file));
};

const probeImage = async (dir: string, name: string, bytes: Uint8Array) => {
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return probeFile(file);
};

test("the exact final frame is extracted at full resolution", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-frames-test-"));
  try {
    const video = await syntheticClip(dir);
    const last = await extractLastFrame(video);
    assert.equal(last.mime, "image/png");
    assert.ok(Math.abs(last.timeSec - 2) < 0.2);
    const probe = await probeImage(dir, "last.png", last.bytes);
    assert.equal(probe.width, 320);
    assert.equal(probe.height, 240);

    // The final frame differs from the first one: the extractor did not just grab frame zero.
    const [first] = await sampleFrames(video, 1, 320);
    assert.ok(first);
    assert.notDeepEqual(Buffer.from(last.bytes).toString("base64"), Buffer.from(first.bytes).toString("base64"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("sampled frames are evenly spaced and scaled down", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-frames-test-"));
  try {
    const video = await syntheticClip(dir);
    const frames = await sampleFrames(video, 4, 160);
    assert.equal(frames.length, 4);
    assert.deepEqual(
      frames.map((frame) => frame.timeSec),
      [0, 0.5, 1, 1.5],
    );
    const probe = await probeImage(dir, "sample.jpg", frames[0]!.bytes);
    assert.equal(probe.width, 160);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the mock placeholder footage yields boundary frames too", async () => {
  const placeholder = new Uint8Array(await readFile(path.join(process.cwd(), "lib/production/fixtures/placeholder.mp4")));
  const frames = await captureBoundaryFrames(placeholder, 3);
  assert.ok(frames.last.bytes.byteLength > 0);
  assert.ok(frames.sampled.length > 0);
});
