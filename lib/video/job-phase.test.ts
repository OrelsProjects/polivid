import assert from "node:assert/strict";
import test from "node:test";
import { jobPhase, roughDuration, shortDuration, typicalSeconds, type PhaseInput } from "./job-phase";

const base: PhaseInput = {
  status: "running",
  currentStep: "videos",
  mode: "prompt",
  modelName: "Kling 3.0",
  characterName: "",
  clipIndex: null,
  clipTotal: 1,
  clipsDone: 0,
  stopping: false,
  needsModel: false,
  stalled: false,
  clipStartedAt: null,
  typicalClipSec: null,
};

const NOW = Date.parse("2026-11-17T20:10:00Z");

test("queued, paused, needs a model, and stalled come before the step", () => {
  assert.equal(jobPhase({ ...base, status: "queued" }, NOW).badge, "QUEUED");
  assert.equal(jobPhase({ ...base, status: "paused", clipsDone: 2, clipTotal: 5 }, NOW).headline, "Paused after clip 2 of 5");
  assert.equal(jobPhase({ ...base, status: "paused", needsModel: true }, NOW).badge, "NEEDS A MODEL");
  assert.equal(jobPhase({ ...base, stalled: true }, NOW).badge, "STALLED");
});

test("each step gets its own badge", () => {
  assert.equal(jobPhase({ ...base, currentStep: "script" }, NOW).badge, "PLANNING");
  assert.equal(jobPhase({ ...base, currentStep: "script", mode: "lyrics" }, NOW).headline, "Writing the song");
  assert.equal(jobPhase({ ...base, currentStep: "videos" }, NOW).badge, "GENERATING");
  assert.equal(jobPhase({ ...base, currentStep: "render", clipTotal: 3 }, NOW).headline, "Stitching 3 clips into one video");
  assert.equal(jobPhase({ ...base, currentStep: "finalize" }, NOW).badge, "FINISHING");
  assert.equal(jobPhase({ ...base, currentStep: null }, NOW).badge, "STARTING");
});

test("generating names the model, the clip, and the character in a swap", () => {
  assert.equal(jobPhase(base, NOW).headline, "Kling 3.0 is generating the video");
  assert.equal(jobPhase({ ...base, clipIndex: 2, clipTotal: 4 }, NOW).headline, "Kling 3.0 is generating clip 2 of 4");
  assert.equal(jobPhase({ ...base, mode: "swap", characterName: "Ohsri" }, NOW).headline, "Kling 3.0 is putting Ohsri into the video");
  assert.equal(jobPhase({ ...base, mode: "lyrics", clipTotal: 6, clipsDone: 2 }, NOW).headline, "Kling 3.0 is generating 6 clips (2 done)");
});

test("generating says how long ago it was sent and how long it usually takes", () => {
  const sent = new Date(NOW - 337_000).toISOString();
  assert.equal(jobPhase({ ...base, clipStartedAt: sent, typicalClipSec: 360 }, NOW).detail, "Sent 5m 37s ago. Usually about 6 min.");
  assert.equal(
    jobPhase({ ...base, clipStartedAt: sent, typicalClipSec: 120 }, NOW).detail,
    "Sent 5m 37s ago. Taking longer than usual (about 2 min).",
  );
  assert.match(jobPhase({ ...base, clipStartedAt: sent }, NOW).detail ?? "", /^Sent 5m 37s ago\. Video models often take/);
  assert.match(jobPhase(base, null).detail ?? "", /^Video models often take/);
});

test("durations read naturally", () => {
  assert.equal(shortDuration(45), "45s");
  assert.equal(shortDuration(372), "6m 12s");
  assert.equal(shortDuration(3840), "1h 4m");
  assert.equal(roughDuration(30), "under a minute");
  assert.equal(roughDuration(4800), "about 1 h 20 min");
});

test("typical time is the median, and needs three samples", () => {
  assert.equal(typicalSeconds([10, 20]), null);
  assert.equal(typicalSeconds([300, 100, 200]), 200);
  assert.equal(typicalSeconds([100, 200, 300, 400]), 250);
});

test("a swap being re-voiced says whose voice it is getting", () => {
  const phase = jobPhase({ ...base, mode: "swap", currentStep: "render", characterName: "Oshri", voiceName: "Oshri" }, NOW);
  assert.equal(phase.badge, "VOICING");
  assert.equal(phase.headline, "Giving Oshri their voice");
  // A character with no voice is never said to be getting one.
  assert.equal(jobPhase({ ...base, mode: "swap", currentStep: "render", characterName: "Oshri" }, NOW).headline, "Rendering the video");
});

test("a swap made in parts counts them, then says it is joining them", () => {
  const filming = jobPhase({ ...base, mode: "swap", characterName: "Oshri", clipTotal: 2, clipsDone: 1 }, NOW);
  assert.equal(filming.headline, "Kling 3.0 is putting Oshri into 2 parts of the video (1 done)");
  const joining = jobPhase({ ...base, mode: "swap", currentStep: "render", characterName: "Oshri", voiceName: "Oshri", clipTotal: 2, clipsDone: 2 }, NOW);
  assert.equal(joining.headline, "Joining the 2 parts and giving Oshri their voice");
});

test("a swap's voice step shows in the stage list before saving, named for the character", async () => {
  const { stagesForJob, stepLabel } = await import("./job-stages");
  const swap = { mode: "swap", tier: "pro", model: "kling-3.0-omni-edit", length: 7 };
  assert.deepEqual(stagesForJob(swap), ["videos", "finalize"]);
  assert.deepEqual(stagesForJob({ ...swap, voiceName: "Greg" }), ["videos", "render", "finalize"]);
  assert.equal(stepLabel("render", "swap", { voiceName: "Greg" }), "Giving Greg their voice");
  assert.equal(stepLabel("render", "swap", { voiceName: "Greg", parts: 2 }), "Joining the parts and giving Greg their voice");
  assert.equal(stepLabel("render", "swap", { parts: 2 }), "Joining the parts");
});

test("the finished video says whether the character's voice was added", async () => {
  const { readVoiceResult, voiceResultLabel } = await import("./job-status");
  assert.deepEqual(readVoiceResult({ characterVoice: { name: "Greg", outcome: "added" } }), { name: "Greg", outcome: "added" });
  assert.equal(readVoiceResult({ characterVoice: { name: "Greg", outcome: "maybe" } }), null);
  assert.equal(readVoiceResult(null), null);
  assert.equal(voiceResultLabel({ name: "Greg", outcome: "added" }), "Greg's voice added");
  assert.match(voiceResultLabel({ name: "Greg", outcome: "no-speech" }), /no speech/);
  assert.match(voiceResultLabel({ name: "Greg", outcome: "failed" }), /Greg's voice couldn't be added/);
});
