import "../../../scripts/server-only-stub.cjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { isOwnedUploadKey } from "@/lib/storage/upload-key";
import { cutClipFile, cutUploadKey } from "./clip-cut";

const execFileAsync = promisify(execFile);
let dir = "";

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "clip-cut-"));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

const make = async (name: string, withSound: boolean) => {
  const file = path.join(dir, name);
  await execFileAsync("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30:duration=22.8",
    ...(withSound ? ["-f", "lavfi", "-i", "sine=duration=22.8", "-c:a", "aac", "-shortest"] : []),
    "-c:v", "libx264",
    file,
  ]);
  return file;
};

test("the kept parts are joined in order, with sound, at their total length", async () => {
  const source = await make("source.mp4", true);
  const output = path.join(dir, "cut.mp4");
  await cutClipFile(source, output, [
    { start: 1, end: 4.5 },
    { start: 10, end: 14 },
    { start: 20, end: 22 },
  ]);
  const probe = await probeFile(output);
  assert.ok(Math.abs(probe.durationSec - 9.5) < 0.15, `${probe.durationSec}s`);
  assert.equal(probe.hasAudio, true);
  assert.equal(probe.width, 720);
});

test("a video with no sound is cut too", async () => {
  const source = await make("silent.mp4", false);
  const output = path.join(dir, "silent-cut.mp4");
  await cutClipFile(source, output, [{ start: 2, end: 8 }]);
  const probe = await probeFile(output);
  assert.ok(Math.abs(probe.durationSec - 6) < 0.15);
  assert.equal(probe.hasAudio, false);
});

test("the cut file is saved where the person's own uploads are read from", () => {
  const key = cutUploadKey("cmwkmru9t000008l83hrjo5kj", "09ef5a6d-648d-4ac9-9dad-d3e8e250be1d");
  assert.equal(isOwnedUploadKey("cmwkmru9t000008l83hrjo5kj", key), true);
});
