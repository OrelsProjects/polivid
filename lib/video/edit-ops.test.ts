import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  EDIT_CHOICES,
  EDIT_OPS,
  describeEdit,
  editFfmpegArgs,
  editFormat,
  editLengthFactor,
  editValueFor,
  isEditOp,
  isEditValue,
} from "./edit-ops";

const run = promisify(execFile);

const probe = async (file: string) => {
  const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  const data = JSON.parse(stdout) as {
    format: { duration: string };
    streams: { codec_type: string; width?: number; height?: number }[];
  };
  const video = data.streams.find((stream) => stream.codec_type === "video");
  return {
    seconds: Number(data.format.duration),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    hasAudio: data.streams.some((stream) => stream.codec_type === "audio"),
  };
};

test("every edit has a default that is one of its own choices", () => {
  for (const op of EDIT_OPS) {
    const choice = EDIT_CHOICES[op];
    assert.ok(choice.values.length >= 2, op);
    assert.ok(isEditValue(op, choice.defaultValue), op);
    assert.equal(new Set(choice.values.map((entry) => entry.value)).size, choice.values.length, op);
  }
  assert.equal(isEditOp("rotate"), true);
  assert.equal(isEditOp("trim"), false);
  assert.equal(isEditOp(undefined), false);
});

test("a value that is not offered falls back to the default", () => {
  assert.equal(editValueFor("rotate", "180"), "180");
  assert.equal(editValueFor("rotate", "45"), "90");
  assert.equal(editValueFor("rotate", "90; rm -rf /"), "90");
  assert.equal(editValueFor("loop", undefined), "3");
  assert.equal(isEditValue("volume", "999"), false);
});

test("edits describe themselves, and know the shape and length they produce", () => {
  assert.equal(describeEdit("rotate", "90"), "Rotate · 90°");
  assert.equal(describeEdit("resize", "9:16:pad"), "Resize · 9:16 fit");
  assert.equal(editFormat("resize", "1:1:crop"), "1:1");
  assert.equal(editFormat("resize", "4:3:crop"), null);
  assert.equal(editFormat("rotate", "90"), null);
  assert.equal(editLengthFactor("loop", "4"), 4);
  assert.equal(editLengthFactor("flip", "horizontal"), 1);
});

test("the arguments never carry anything that was not on the list", () => {
  const args = editFfmpegArgs({ op: "volume", value: "150; touch /tmp/x", source: "in.mp4", output: "out.mp4", hasAudio: true });
  assert.ok(args.includes("volume=1.50"));
  assert.equal(args.some((arg) => arg.includes("touch")), false);
});

test("each edit does what it says to a real clip", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-edit-test-"));
  try {
    const source = path.join(dir, "in.mp4");
    await run("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source,
    ]);
    const before = await probe(source);
    assert.equal(before.width, 640);
    assert.equal(before.hasAudio, true);
    const edit = async (op: Parameters<typeof editFfmpegArgs>[0]["op"], value: string, hasAudio = true) => {
      const output = path.join(dir, `${op}-${value.replaceAll(":", "_")}.mp4`);
      await run("ffmpeg", ["-loglevel", "error", ...editFfmpegArgs({ op, value, source, output, hasAudio })]);
      return probe(output);
    };

    const turned = await edit("rotate", "90");
    assert.deepEqual([turned.width, turned.height], [360, 640]);
    assert.equal(turned.hasAudio, true);
    const upsideDown = await edit("rotate", "180");
    assert.deepEqual([upsideDown.width, upsideDown.height], [640, 360]);

    const mirrored = await edit("flip", "horizontal");
    assert.deepEqual([mirrored.width, mirrored.height], [640, 360]);

    const filled = await edit("resize", "9:16:crop");
    assert.deepEqual([filled.width, filled.height], [1080, 1920]);
    const fitted = await edit("resize", "1:1:pad");
    assert.deepEqual([fitted.width, fitted.height], [1080, 1080]);
    assert.equal(fitted.hasAudio, true);

    const looped = await edit("loop", "3");
    assert.ok(Math.abs(looped.seconds - before.seconds * 3) < 0.4, `${looped.seconds}`);

    const muted = await edit("volume", "0");
    assert.equal(muted.hasAudio, false);
    assert.deepEqual([muted.width, muted.height], [640, 360]);
    const louder = await edit("volume", "200");
    assert.equal(louder.hasAudio, true);
    assert.ok(Math.abs(louder.seconds - before.seconds) < 0.3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
