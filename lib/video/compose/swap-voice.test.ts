import "../../../scripts/server-only-stub.cjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { revoiceVideo, type RevoiceSteps } from "./swap-voice";

const execFileAsync = promisify(execFile);
let dir = "";

const ffmpeg = (args: string[]) => execFileAsync("ffmpeg", ["-v", "error", "-y", ...args]);

/** A 3-second clip, with a tone standing in for speech at `volume` (or no sound at all). */
const clip = async (name: string, volume: number | null) => {
  const file = path.join(dir, name);
  const picture = ["-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=3"];
  const sound = volume === null ? [] : ["-f", "lavfi", "-i", `sine=frequency=220:duration=3,volume=${volume}`];
  await ffmpeg([...picture, ...sound, "-c:v", "libx264", ...(volume === null ? [] : ["-c:a", "aac", "-shortest"]), file]);
  return new Uint8Array(await readFile(file));
};

/** A tone as MP3, standing in for the voice ElevenLabs sends back. */
const tone = async (frequency: number, seconds: number) => {
  const file = path.join(dir, `tone-${frequency}.mp3`);
  await ffmpeg(["-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${seconds}`, "-c:a", "libmp3lame", file]);
  return new Uint8Array(await readFile(file));
};

const probeBytes = async (bytes: Uint8Array) => {
  const file = path.join(dir, `probe-${Math.random().toString(36).slice(2)}.mp4`);
  await writeFile(file, bytes);
  return probeFile(file);
};

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "swap-voice-"));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("speech is re-voiced and the picture and length stay", async () => {
  const video = await clip("speech.mp4", 0.8);
  const calls: string[] = [];
  const steps: RevoiceSteps = {
    separateVocal: async (sound) => ({ vocal: sound, backing: [] }),
    changeVoice: async (_vocal, voiceId) => {
      calls.push(voiceId);
      return tone(660, 3);
    },
  };
  const result = await revoiceVideo(video, "voice-123", steps);
  assert.ok(result, "expected a re-voiced video");
  assert.deepEqual(calls, ["voice-123"]);
  const before = await probeBytes(video);
  const after = await probeBytes(result);
  assert.equal(after.hasVideo, true);
  assert.equal(after.hasAudio, true);
  assert.equal(after.width, before.width);
  assert.ok(Math.abs(after.durationSec - before.durationSec) < 0.15, `${after.durationSec} vs ${before.durationSec}`);
});

test("a shorter new voice is padded, so the video doesn't end early", async () => {
  const video = await clip("short-voice.mp4", 0.8);
  const steps: RevoiceSteps = {
    separateVocal: async (sound) => ({ vocal: sound, backing: [] }),
    changeVoice: async () => tone(660, 1.5),
  };
  const result = await revoiceVideo(video, "voice-123", steps);
  assert.ok(result);
  assert.ok((await probeBytes(result)).durationSec > 2.8);
});

test("a video with no sound is left alone, with no paid steps", async () => {
  const video = await clip("silent.mp4", null);
  let called = false;
  const steps: RevoiceSteps = {
    separateVocal: async () => {
      called = true;
      throw new Error("should not split");
    },
    changeVoice: async () => {
      called = true;
      throw new Error("should not change");
    },
  };
  assert.equal(await revoiceVideo(video, "voice-123", steps), null);
  assert.equal(called, false);
});

test("a near-silent vocal skips the voice change", async () => {
  const video = await clip("quiet.mp4", 0.0005);
  let changed = false;
  const steps: RevoiceSteps = {
    separateVocal: async (sound) => ({ vocal: sound, backing: [] }),
    changeVoice: async () => {
      changed = true;
      return tone(660, 3);
    },
  };
  assert.equal(await revoiceVideo(video, "voice-123", steps), null);
  assert.equal(changed, false);
});

test("a failed voice change throws, so the worker keeps the original sound", async () => {
  const video = await clip("fails.mp4", 0.8);
  const steps: RevoiceSteps = {
    separateVocal: async (sound) => ({ vocal: sound, backing: [] }),
    changeVoice: async () => {
      throw new Error("Changing the voice failed (500).");
    },
  };
  await assert.rejects(revoiceVideo(video, "voice-123", steps), /Changing the voice failed/);
});
