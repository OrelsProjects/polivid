import "../../../scripts/server-only-stub.cjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { swapParts } from "../swap";
import { stitchClips } from "../stitch";
import { cutSwapPart, sceneCutTimes, swapPartTaskSeconds } from "./swap-parts";

const execFileAsync = promisify(execFile);
let dir = "";

const ffmpeg = (args: string[]) => execFileAsync("ffmpeg", ["-v", "error", "-y", ...args]);

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "swap-parts-"));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A phone-shaped clip with sound: two different shots, cut at `cutAt` seconds. */
const twoShots = async (name: string, total: number, cutAt: number) => {
  const file = path.join(dir, name);
  await ffmpeg([
    "-f", "lavfi", "-i", `color=c=red:size=720x1280:rate=30:duration=${cutAt}`,
    "-f", "lavfi", "-i", `testsrc=size=720x1280:rate=30:duration=${(total - cutAt).toFixed(3)}`,
    "-f", "lavfi", "-i", `sine=frequency=300:duration=${total}`,
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
    "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-c:a", "aac", "-shortest",
    file,
  ]);
  return file;
};

test("scene cuts are found where the video changes shot", async () => {
  const file = await twoShots("shots.mp4", 22.8, 10.2);
  const cuts = await sceneCutTimes(file);
  assert.ok(cuts.some((time) => Math.abs(time - 10.2) < 0.1), `cuts: ${cuts.join(", ")}`);
});

test("a long video is cut into padded whole-second parts and joins back at its own length", async () => {
  const source = await twoShots("long.mp4", 22.8, 10.2);
  const probe = await probeFile(source);
  const parts = swapParts(probe.durationSec, 15, await sceneCutTimes(source));
  assert.equal(parts.length, 2);
  assert.ok(Math.abs(parts[0]!.seconds - 10.2) < 0.1, "the join moved onto the scene cut");

  const cuts: Uint8Array[] = [];
  for (const [index, part] of parts.entries()) {
    const output = path.join(dir, `part-${index}.mp4`);
    await cutSwapPart(source, output, part, "replace", probe);
    const cut = await probeFile(output);
    // Kling edits whole seconds, so each part is held up to the next one.
    assert.ok(Math.abs(cut.durationSec - swapPartTaskSeconds(part)) < 0.1, `part ${index} is ${cut.durationSec}s`);
    assert.equal(cut.hasAudio, true);
    // The swapped part stands in for what Kling sends back.
    cuts.push(new Uint8Array(await readFile(output)));
  }

  const joined = path.join(dir, "joined.mp4");
  await import("node:fs/promises").then(({ writeFile }) => stitchClips(cuts, parts.map((part) => part.seconds)).then((bytes) => writeFile(joined, bytes)));
  const result = await probeFile(joined);
  assert.ok(Math.abs(result.durationSec - probe.durationSec) < 0.15, `joined ${result.durationSec}s vs ${probe.durationSec}s`);
  assert.equal(result.width, 720);
  assert.equal(result.hasAudio, true);
});

test("copying the moves cuts parts at their own length, with no hold", async () => {
  const source = await twoShots("moves.mp4", 12, 5);
  const probe = await probeFile(source);
  const part = { start: 2.5, seconds: 6.4 };
  const output = path.join(dir, "moves-part.mp4");
  await cutSwapPart(source, output, part, "moves", probe);
  assert.ok(Math.abs((await probeFile(output)).durationSec - 6.4) < 0.1);
});
