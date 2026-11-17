import assert from "node:assert/strict";
import test from "node:test";
import { videoJobCredits } from "@/lib/billing/estimate";
import { jobCreditsFromUsd } from "@/lib/billing/math";
import { creditsForToolInput } from "@/lib/tools/tool-credits";
import { stagesForJob } from "./job-stages";
import { generationModelLabel } from "./models";
import { describeModeTier, defaultPromptForMode, resolveModeTier, videoModeById } from "./modes";
import { CREATE_TOOLS } from "./tool-catalog";
import {
  MAX_SWAP_SECONDS,
  SWAP_LABEL,
  SWAP_MODEL,
  isSwapOrientation,
  swapCredits,
  swapLengthProblem,
  swapResolutionFor,
  swapSeconds,
} from "./swap";

test("a swap is billed per started second of the performance video", () => {
  assert.equal(swapSeconds(7.2), 8);
  assert.equal(swapCredits(7.2, "720p"), jobCreditsFromUsd(8 * 0.126));
  assert.equal(swapCredits(10, "1080p"), jobCreditsFromUsd(10 * 0.168));
  // An unknown resolution is priced as 720p, never as free.
  assert.equal(swapCredits(10, "4k"), swapCredits(10, "720p"));
});

test("ultra swaps at 1080p and the other tiers at 720p", () => {
  assert.equal(swapResolutionFor("ultra"), "1080p");
  assert.equal(swapResolutionFor("pro"), "720p");
  assert.equal(swapResolutionFor("low"), "720p");
  assert.equal(swapResolutionFor(undefined), "720p");
  for (const tier of ["low", "pro", "ultra"] as const) {
    const resolved = resolveModeTier("swap", tier);
    assert.ok(resolved);
    assert.equal(resolved.model, null);
    assert.equal(resolved.resolution, swapResolutionFor(tier));
  }
});

test("the performance video must run 3 seconds, and at most 30 or 10 by framing", () => {
  assert.match(swapLengthProblem(2.4, "video") ?? "", /at least 3 seconds/);
  assert.equal(swapLengthProblem(3, "video"), null);
  assert.equal(swapLengthProblem(30.4, "video"), null);
  assert.match(swapLengthProblem(31, "video") ?? "", /30 seconds or less/);
  assert.equal(swapLengthProblem(10, "image"), null);
  assert.match(swapLengthProblem(12, "image") ?? "", /up to 10 seconds/);
  assert.equal(MAX_SWAP_SECONDS.video, 30);
  assert.equal(isSwapOrientation("image"), true);
  assert.equal(isSwapOrientation("sideways"), false);
});

test("the job estimate prices a swap from its length and resolution", () => {
  assert.equal(videoJobCredits({ mode: "swap", length: 12, resolution: "1080p" }), swapCredits(12, "1080p"));
  assert.equal(videoJobCredits({ demo: true, mode: "swap", length: 12, resolution: "1080p" }), 0);
});

test("the tool price waits for the server, which reads the upload's length", () => {
  assert.equal(creditsForToolInput("make_character_swap", { mediaKey: "uploads/u/a.mp4", length: 5 }), null);
  assert.equal(creditsForToolInput("create_video", { mode: "swap", length: 5 }), null);
});

test("a swap is listed for agents, not on the Create page", () => {
  const mode = videoModeById("swap");
  assert.ok(mode);
  assert.equal(mode.upload, "video");
  assert.equal(mode.agentOnly, true);
  assert.equal(CREATE_TOOLS.some((tool) => tool.mode === "swap"), false);
  assert.equal(defaultPromptForMode(mode).length >= 3, true);
  assert.equal(describeModeTier(mode.tiers!.pro).name, SWAP_LABEL);
  assert.equal(generationModelLabel(SWAP_MODEL), SWAP_LABEL);
  assert.deepEqual(stagesForJob({ mode: "swap", tier: "pro", model: SWAP_MODEL, length: 8 }), ["videos", "finalize"]);
});
