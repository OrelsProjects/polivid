import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { beatCutTimes, heldVoiceArgs, shotSpans, skitVoiceText, type SkitVoiceLine } from "./skit-voice";
import { skitBeats, skitVoiceLines } from "./skit";

/** Times each character evenly, `perChar` seconds apiece, with `gap` seconds of breath after each beat. */
const timesFor = (text: string, ranges: [number, number][], perChar = 0.05, gap = 0.4) => {
  const starts: number[] = [];
  const ends: number[] = [];
  let clock = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (ranges.some(([, end], at) => at < ranges.length - 1 && index === end)) clock += gap;
    starts.push(clock);
    clock += perChar;
    ends.push(clock);
  }
  return { characters: [...text], starts, ends, total: clock };
};

test("the whole script is read as one text, and each beat knows where its words are", () => {
  const { text, ranges } = skitVoiceText([
    { say: "Day one.", after: 0 },
    { say: " Coffee spills. ", after: 1 },
    { say: "Gone.", after: 0 },
  ]);
  assert.equal(text, "Day one. Coffee spills. Gone.");
  assert.deepEqual(
    ranges.map(([start, end]) => text.slice(start, end)),
    ["Day one.", "Coffee spills.", "Gone."],
  );
});

test("each cut falls in the breath between two lines, and the last shot runs to the end of the take", () => {
  const lines: SkitVoiceLine[] = [
    { say: "Day one.", after: 0 },
    { say: "Coffee spills.", after: 0 },
  ];
  const { text, ranges } = skitVoiceText(lines);
  const times = timesFor(text, ranges);
  const cuts = beatCutTimes(text, ranges, times, times.total + 0.3);
  assert.ok(cuts);
  assert.equal(cuts.length, 3);
  assert.equal(cuts[0], 0);
  const firstEnd = times.ends[ranges[0]![1] - 1]!;
  const secondStart = times.starts[ranges[1]![0]]!;
  assert.ok(cuts[1]! > firstEnd && cuts[1]! < secondStart, "the cut is between the lines, not inside a word");
  assert.equal(cuts[2], times.total + 0.3);
  // The shots add up to the whole take: the voice sets the length.
  const spans = shotSpans(cuts, lines);
  assert.ok(Math.abs(spans.reduce((sum, span) => sum + span, 0) - (times.total + 0.3)) < 1e-9);
});

test("a pause after a line keeps its shot on screen that much longer", () => {
  const lines: SkitVoiceLine[] = [
    { say: "Wait for it.", after: 1.5 },
    { say: "There.", after: 0 },
  ];
  const { text, ranges } = skitVoiceText(lines);
  const times = timesFor(text, ranges);
  const cuts = beatCutTimes(text, ranges, times, times.total)!;
  const spans = shotSpans(cuts, lines);
  assert.ok(Math.abs(spans[0]! - (cuts[1]! + 1.5)) < 1e-9);
  assert.ok(Math.abs(spans[1]! - (cuts[2]! - cuts[1]!)) < 1e-9);
});

test("timings that don't match the text aren't used", () => {
  const lines = [
    { say: "One.", after: 0 },
    { say: "Two.", after: 0 },
  ];
  const { text, ranges } = skitVoiceText(lines);
  const times = timesFor(text, ranges);
  assert.equal(beatCutTimes(text, ranges, { ...times, characters: times.characters.slice(1) }, times.total), null);
  assert.equal(beatCutTimes(text, ranges, { ...times, characters: [...times.characters].reverse() }, times.total), null);
  assert.equal(beatCutTimes(text, [], times, times.total), null);
});

test("the voice holds the script's pauses and the plan's holds", () => {
  const beats = skitBeats("[a big yawn] Mornings are hard. [pause 1s] [sips coffee] Coffee helps.", [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(beats.length, 2);
  assert.deepEqual(
    skitVoiceLines(beats, [{ hold: 2 }, { hold: 0 }]).map((line) => line.after),
    [3, 0],
  );
  assert.deepEqual(
    skitVoiceLines(beats, [{ hold: 99 }]).map((line) => line.after),
    [11, 0],
    "a hold is capped, and a missing one is none",
  );
});

test("the held voice is the take with each pause put back between lines", { skip: !hasFfmpeg() }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "skit-voice-test-"));
  try {
    const input = path.join(dir, "take.mp3");
    const output = path.join(dir, "held.mp3");
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-t", "3", "-i", "sine=frequency=440:sample_rate=44100", "-c:a", "libmp3lame", input], { stdio: "ignore" });
    const lines = [
      { say: "a", after: 1.5 },
      { say: "b", after: 0 },
      { say: "c", after: 0.5 },
    ];
    execFileSync("ffmpeg", heldVoiceArgs(input, output, [0, 1, 2, 3], lines), { stdio: "ignore" });
    const seconds = Number(
      execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", output]).toString().trim(),
    );
    assert.ok(Math.abs(seconds - 5) < 0.15, `${seconds} seconds`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
