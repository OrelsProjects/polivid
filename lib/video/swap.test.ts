import assert from "node:assert/strict";
import test from "node:test";
import { videoJobCredits } from "@/lib/billing/estimate";
import { jobCreditsFromUsd } from "@/lib/billing/math";
import { creditsForToolInput } from "@/lib/tools/tool-credits";
import { stagesForJob } from "./job-stages";
import { generationModelLabel } from "./models";
import { describeModeTier, defaultPromptForMode, resolveModeTier, videoModeById } from "./modes";
import { buildCreateBody } from "./create-body";
import { formSpecFor } from "./form-spec";
import { CREATE_TOOLS } from "./tool-catalog";
import {
  MAX_SWAP_SECONDS,
  SWAP_EDIT_LABEL,
  SWAP_EDIT_MODEL,
  SWAP_LABEL,
  SWAP_MODEL,
  isSwapOrientation,
  swapEditConversion,
  swapEditDuration,
  swapEditPrompt,
  swapEditShapeProblem,
  swapMethodForModel,
  swapModelFor,
  swapMovesPrompt,
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

test("copying the moves takes 3 seconds, and at most 30 or 10 by framing", () => {
  assert.match(swapLengthProblem(2.4, "moves", "video") ?? "", /at least 3 seconds/);
  assert.equal(swapLengthProblem(3, "moves", "video"), null);
  assert.equal(swapLengthProblem(30.4, "moves", "video"), null);
  assert.match(swapLengthProblem(31, "moves", "video") ?? "", /30 seconds or less/);
  assert.equal(swapLengthProblem(10, "moves", "image"), null);
  assert.match(swapLengthProblem(12, "moves", "image") ?? "", /up to 10 seconds/);
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

test("a swap is a Create tool that takes a video and a character", () => {
  const mode = videoModeById("swap");
  assert.ok(mode);
  assert.equal(mode.upload, "video");
  assert.equal(CREATE_TOOLS.some((tool) => tool.slug === "swap"), true);
  const spec = formSpecFor(mode);
  assert.equal(spec.uploadKind, "video");
  assert.equal(spec.showPrompt, true);
  assert.deepEqual([...spec.sections].sort(), ["character", "tier"]);
  assert.equal(defaultPromptForMode(mode).length >= 3, true);
  assert.equal(describeModeTier(mode.tiers!.pro).name, "Kling 3.0");
  assert.equal(generationModelLabel(SWAP_MODEL), SWAP_LABEL);
  assert.equal(generationModelLabel(SWAP_EDIT_MODEL), SWAP_EDIT_LABEL);
  assert.deepEqual(stagesForJob({ mode: "swap", tier: "pro", model: SWAP_MODEL, length: 8 }), ["videos", "finalize"]);
});

test("the Create form sends a swap with its video and character, and no footage model", () => {
  const body = buildCreateBody({
    mode: "swap",
    usesVideoModel: true,
    values: {
      prompt: "  red jacket ",
      format: "9:16",
      length: 10,
      tier: "ultra",
      model: "wan",
      mediaKey: "uploads/u/dance.mp4",
      referenceKeys: ["uploads/u/extra.png"],
      showText: true,
      presetId: "default",
      visualDirection: "",
      characterId: "c-1",
      characterLookId: "look-1",
      direction: "",
      scene: "",
      directionKeys: [],
      sceneKeys: [],
    },
  });
  assert.deepEqual(body, {
    prompt: "red jacket",
    format: "9:16",
    length: 10,
    mode: "swap",
    tier: "ultra",
    mediaKey: "uploads/u/dance.mp4",
    characterId: "c-1",
    characterLookId: "look-1",
  });
});

test("replacing in a video takes 3 to 15.5 seconds, and the model records the method", () => {
  assert.equal(swapLengthProblem(7, "replace"), null);
  assert.equal(swapLengthProblem(15.5, "replace"), null);
  assert.match(swapLengthProblem(16, "replace") ?? "", /up to 15 seconds/);
  assert.match(swapLengthProblem(2, "replace") ?? "", /at least 3 seconds/);
  assert.equal(swapModelFor("replace"), SWAP_EDIT_MODEL);
  assert.equal(swapModelFor("moves"), SWAP_MODEL);
  assert.equal(swapMethodForModel(SWAP_EDIT_MODEL), "replace");
  assert.equal(swapMethodForModel(SWAP_MODEL), "moves");
  assert.equal(swapEditDuration(6.6), 7);
  assert.equal(swapEditDuration(2.2), 3);
  assert.equal(swapEditDuration(15.4), 15);
});

test("the edit prompt points the character's name at the picture and keeps the rest of the video", () => {
  const prompt = swapEditPrompt("Replace the monkey with Greg", "Greg");
  assert.match(prompt, /^Replace the monkey with @image_1\. Keep everything else in the video unchanged/);
  // No name in the text still tells Kling who the picture is.
  assert.match(swapEditPrompt("Replace the monkey", "Greg"), /^Replace the monkey\. The new character is the person in @image_1\./);
  // Nothing written replaces the main person.
  assert.match(swapEditPrompt("Character swap", "Greg"), /^Replace the main person in the video with the person in @image_1\./);
  assert.match(swapEditPrompt("", null), /@image_1/);
});

test("copying the moves sends notes only when written, with the name as the person in the picture", () => {
  assert.equal(swapMovesPrompt("Character swap", "Greg"), "");
  assert.equal(swapMovesPrompt("Greg in a red jacket", "Greg"), "the person in the picture in a red jacket");
});

test("a small or slow video is scaled up before Kling edits it, and an odd shape is refused", () => {
  // A 480x854 phone clip becomes 720 wide, kept even.
  assert.deepEqual(swapEditConversion({ width: 480, height: 854, fps: 30 }), { width: 720, height: 1282, fps: null });
  assert.deepEqual(swapEditConversion({ width: 1080, height: 1920, fps: 15 }), { width: 1080, height: 1920, fps: 24 });
  assert.equal(swapEditConversion({ width: 1080, height: 1920, fps: 30 }), null);
  assert.equal(swapEditConversion({ width: null, height: null, fps: null }), null);
  assert.equal(swapEditShapeProblem(1080, 1920), null);
  assert.match(swapEditShapeProblem(400, 1200) ?? "", /2:5 tall/);
});
