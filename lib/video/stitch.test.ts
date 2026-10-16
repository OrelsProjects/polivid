import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { lastFrameDataUrl, assembleSongVideo, stitchClips } from "./stitch";

const execFileAsync = promisify(execFile);

const lavfiClip = async (dir: string, name: string, duration: number, silent: boolean) => {
  const file = path.join(dir, name);
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc=size=320x240:rate=10:duration=${duration}`,
    ...(silent ? [] : ["-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`]),
    "-pix_fmt",
    "yuv420p",
    file,
  ];
  await execFileAsync("ffmpeg", args);
  return new Uint8Array(await readFile(file));
};

test("two clips, one silent, stitch into one file whose duration is the sum", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-stitch-test-"));
  try {
    const first = await lavfiClip(dir, "a.mp4", 2, false);
    const second = await lavfiClip(dir, "b.mp4", 3, true);
    const stitched = await stitchClips([first, second]);
    const file = path.join(dir, "out.mp4");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, stitched);
    const probe = await probeFile(file);
    assert.ok(probe.hasVideo);
    assert.ok(probe.hasAudio);
    assert.ok(Math.abs(probe.durationSec - 5) < 0.4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a song laid under two clips stays one continuous track", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-song-assemble-"));
  try {
    const first = await lavfiClip(dir, "a.mp4", 2, true);
    const second = await lavfiClip(dir, "b.mp4", 2, true);
    const songFile = path.join(dir, "bed.wav");
    await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", songFile]);
    const song = new Uint8Array(await readFile(songFile));
    const assembled = await assembleSongVideo({
      clips: [first, second],
      durations: [2, 2],
      song,
      words: [
        { text: "Coffee", startMs: 200, endMs: 700 },
        { text: "cold", startMs: 700, endMs: 1200 },
      ],
      showText: true,
    });
    const file = path.join(dir, "out.mp4");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, assembled);
    const probe = await probeFile(file);
    assert.ok(probe.hasVideo);
    assert.ok(probe.hasAudio);
    assert.ok(Math.abs(probe.durationSec - 4) < 0.4);
    const detected = await execFileAsync("ffmpeg", [
      "-i",
      file,
      "-af",
      "silencedetect=noise=-35dB:d=0.15",
      "-f",
      "null",
      "-",
    ]);
    assert.equal(`${detected.stdout}${detected.stderr}`.includes("silence_start"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the last frame becomes a png data URL", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-frame-url-"));
  try {
    const clip = await lavfiClip(dir, "clip.mp4", 1, true);
    const dataUrl = await lastFrameDataUrl(clip);
    assert.ok(dataUrl.startsWith("data:image/png;base64,"));
    assert.ok(dataUrl.length > 100);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
