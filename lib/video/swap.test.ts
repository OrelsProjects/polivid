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
  swapPictureConversion,
  swapMethodForModel,
  swapModelFor,
  swapMovesPrompt,
  swapCredits,
  swapLengthProblem,
  swapPartCount,
  swapPartLimit,
  swapParts,
  swapSplitNote,
  MAX_SWAP_TOTAL_SECONDS,
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

test("a swap takes 3 seconds to 2 minutes; past one task's limit it is split, not refused", () => {
  assert.match(swapLengthProblem(2.4) ?? "", /at least 3 seconds/);
  assert.equal(swapLengthProblem(3), null);
  assert.equal(swapLengthProblem(31), null);
  assert.equal(swapLengthProblem(MAX_SWAP_TOTAL_SECONDS), null);
  assert.match(swapLengthProblem(MAX_SWAP_TOTAL_SECONDS + 5) ?? "", /up to 2 minutes/);
  assert.equal(swapPartLimit("moves", "video"), 30);
  assert.equal(swapPartLimit("moves", "image"), 10);
  assert.equal(swapPartLimit("replace"), 15);
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

test("replacing in a video works from 3 seconds, and the model records the method", () => {
  assert.equal(swapLengthProblem(7), null);
  assert.equal(swapLengthProblem(22.8), null);
  assert.match(swapLengthProblem(2) ?? "", /at least 3 seconds/);
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

test("character pictures are fitted to what Kling accepts", () => {
  // Too narrow and too tall: scaled so the short side is 1024, then given side margins up to 1:2.5.
  assert.deepEqual(swapPictureConversion(226, 627), { width: 1024, height: 2840, canvasWidth: 1138, canvasHeight: 2840 });
  // Small but a fine shape: scaled up only.
  assert.deepEqual(swapPictureConversion(189, 247), { width: 1024, height: 1338, canvasWidth: 1024, canvasHeight: 1338 });
  // Big enough but too wide: margins above and below only.
  assert.deepEqual(swapPictureConversion(3000, 900), { width: 3000, height: 900, canvasWidth: 3000, canvasHeight: 1202 });
  // A huge picture is kept within 4096 on its long side.
  const huge = swapPictureConversion(300, 5000);
  assert.ok(huge && Math.max(huge.canvasWidth, huge.canvasHeight) <= 4096);
  assert.ok(huge && huge.canvasWidth / huge.canvasHeight >= 0.4);
  // Already fine, or size unknown: sent as is.
  assert.equal(swapPictureConversion(1025, 1340), null);
  assert.equal(swapPictureConversion(null, 600), null);
});

test("every fitted picture is within Kling's limits", () => {
  for (const [w, h] of [[120, 900], [900, 120], [299, 299], [300, 1000], [4000, 500], [64, 64], [226, 627], [227, 631], [5001, 777]]) {
    const fit = swapPictureConversion(w, h);
    const width = fit?.canvasWidth ?? w;
    const height = fit?.canvasHeight ?? h;
    assert.ok(Math.min(width, height) >= 300, `${w}x${h} -> ${width}x${height} too small`);
    assert.ok(width / height >= 0.4 && width / height <= 2.5, `${w}x${h} -> ${width}x${height} bad shape`);
    if (fit) assert.ok([fit.width, fit.height, fit.canvasWidth, fit.canvasHeight].every((side) => side % 2 === 0), `${w}x${h} has an odd side`);
    if (fit) assert.ok(fit.canvasWidth >= fit.width && fit.canvasHeight >= fit.height, `${w}x${h} canvas smaller than the picture`);
  }
});

test("a video that fits one task is one part; a longer one splits evenly", () => {
  assert.deepEqual(swapParts(12, 15), [{ start: 0, seconds: 12 }]);
  assert.deepEqual(swapParts(15, 15), [{ start: 0, seconds: 15 }]);
  assert.deepEqual(swapParts(22.8, 15), [{ start: 0, seconds: 11.4 }, { start: 11.4, seconds: 11.4 }]);
  assert.equal(swapPartCount(22.8, "replace"), 2);
  assert.equal(swapPartCount(15, "replace"), 1);
  assert.equal(swapPartCount(45, "moves", "video"), 2);
  assert.equal(swapPartCount(21, "moves", "image"), 3);
});

test("a split point moves to a nearby scene cut, and parts stay within 3 seconds and the limit", () => {
  // The even split is at 11.4; a cut at 10.2 is close enough to take.
  assert.deepEqual(swapParts(22.8, 15, [10.2]), [{ start: 0, seconds: 10.2 }, { start: 10.2, seconds: 12.6 }]);
  // A cut too far from the even split is ignored.
  assert.deepEqual(swapParts(22.8, 15, [2]), [{ start: 0, seconds: 11.4 }, { start: 11.4, seconds: 11.4 }]);
  // A cut that would leave a part over the limit is ignored.
  assert.deepEqual(swapParts(29, 15, [13.2]), [{ start: 0, seconds: 14.5 }, { start: 14.5, seconds: 14.5 }]);
  for (const total of [15.2, 16, 22.8, 31, 44.9, 60, 89, 120]) {
    for (const cuts of [[], [4, 9.5, 17, 33.3, 61]]) {
      const parts = swapParts(total, 15, cuts);
      const sum = parts.reduce((all, part) => all + part.seconds, 0);
      assert.ok(Math.abs(sum - total) < 0.01, `${total}: parts add to ${sum}`);
      assert.equal(parts.length, Math.ceil(total / 15));
      for (const [index, part] of parts.entries()) {
        assert.ok(part.seconds >= 3 && part.seconds <= 15.001, `${total}: part ${index} is ${part.seconds}`);
        if (index > 0) assert.ok(Math.abs(part.start - (parts[index - 1]!.start + parts[index - 1]!.seconds)) < 0.002);
      }
    }
  }
});

test("the form says when a video is swapped in parts", () => {
  assert.match(swapSplitNote(22.8, "replace") ?? "", /22\.8 seconds.*2 parts and joined back/);
  assert.equal(swapSplitNote(12, "replace"), null);
  assert.equal(swapSplitNote(22.8, "moves"), null);
});
