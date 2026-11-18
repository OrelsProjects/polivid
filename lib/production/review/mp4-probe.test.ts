import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { probeFile } from "./ffmpeg";
import { probeMp4File } from "./mp4-probe";

const execFileAsync = promisify(execFile);
let dir = "";

const make = async (name: string, args: string[]) => {
  const file = path.join(dir, name);
  await execFileAsync("ffmpeg", ["-v", "error", "-y", ...args, file]);
  return file;
};

const picture = (size: string, seconds: number) => ["-f", "lavfi", "-i", `testsrc=size=${size}:rate=30:duration=${seconds}`];
const tone = (seconds: number) => ["-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`];

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "mp4-probe-"));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** The header read matches ffprobe on everything but the frame rate, which it leaves out. */
const matchesFfprobe = async (file: string) => {
  const expected = await probeFile(file);
  const actual = await probeMp4File(file);
  assert.ok(actual, "expected a probe");
  assert.ok(Math.abs(actual.durationSec - expected.durationSec) < 0.1, `duration ${actual.durationSec} vs ${expected.durationSec}`);
  assert.equal(actual.width, expected.width);
  assert.equal(actual.height, expected.height);
  assert.equal(actual.hasVideo, expected.hasVideo);
  assert.equal(actual.hasAudio, expected.hasAudio);
  assert.equal(actual.fps, null);
  assert.ok(actual.codec);
};

test("an MP4 with its header first matches ffprobe", async () => {
  const file = await make("front.mp4", [...picture("640x360", 2), ...tone(2), "-c:v", "libx264", "-c:a", "aac", "-shortest", "-movflags", "+faststart"]);
  await matchesFfprobe(file);
});

test("a portrait MP4 with its header last and no sound matches ffprobe", async () => {
  const file = await make("end.mp4", [...picture("360x640", 3), "-c:v", "libx264"]);
  await matchesFfprobe(file);
  assert.equal((await probeMp4File(file))?.hasAudio, false);
});

test("a MOV matches ffprobe", async () => {
  const file = await make("clip.mov", [...picture("320x240", 1.5), ...tone(1.5), "-c:v", "libx264", "-c:a", "aac", "-shortest"]);
  await matchesFfprobe(file);
});

test("files that are not MP4 or MOV give null", async () => {
  const webm = await make("clip.webm", [...picture("320x240", 1), "-c:v", "libvpx-vp9", "-b:v", "200k"]);
  assert.equal(await probeMp4File(webm), null);
  const text = path.join(dir, "notes.txt");
  await writeFile(text, "not a video at all, just some words");
  assert.equal(await probeMp4File(text), null);
});

test("probeFile reads the header when ffprobe isn't installed", async () => {
  const file = await make("nobinary.mp4", [...picture("480x270", 2), "-c:v", "libx264"]);
  const savedPath = process.env.PATH;
  process.env.PATH = dir;
  try {
    const probe = await probeFile(file);
    assert.equal(probe.width, 480);
    assert.equal(probe.height, 270);
    assert.ok(Math.abs(probe.durationSec - 2) < 0.1);
    assert.equal(probe.fps, null);
  } finally {
    process.env.PATH = savedPath;
  }
});

test("probeFile still fails without ffprobe for a format it can't read", async () => {
  const webm = await make("nobinary.webm", [...picture("320x240", 1), "-c:v", "libvpx-vp9", "-b:v", "200k"]);
  const savedPath = process.env.PATH;
  process.env.PATH = dir;
  try {
    await assert.rejects(probeFile(webm), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
  } finally {
    process.env.PATH = savedPath;
  }
});
