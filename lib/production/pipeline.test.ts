import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { mockAdapterSet, resetMockAdapters } from "./adapters/mock";
import { checkCapabilityCombo, preflight, repairPreflightStructure } from "./capabilities";
import { defaultVideoCapability } from "./capabilities/registry";
import { compileShotPrompt } from "./compile";
import { applyExtension, decideSubmit, nextLipsyncStep } from "./jobs/idempotency";
import { plannedStepsAfterApprove } from "./jobs/graph";
import { createMockPlanner, mockDevelop, mockStructure } from "./planner";
import { applyAnswers, needsUserQuestions, runDevelopPass, runStructurePass } from "./plan";
import { invalidate } from "./revisions";
import { compareTranscript } from "./review/speech";
import { checkMediaFile, timelineDuration } from "./review/ffmpeg";
import { DevelopOutputSchema, StructureOutputSchema } from "./schema";
import { TimelineSchema } from "@/lib/editor/schema";
import { compileToEditorTimeline, validateProductionTimeline } from "./timeline";

const execFileAsync = promisify(execFile);

test("a vague idea becomes a coherent script with visible assumptions", async () => {
  const planner = createMockPlanner();
  const { develop, validation } = await runDevelopPass(planner, {
    text: "someone waiting",
    format: "9:16",
    durationSec: 30,
    language: "en",
    delegated: true,
  });
  assert.equal(develop.classification, "rough_idea");
  assert.ok(develop.assumptions.assumptions.length > 0);
  assert.ok(develop.script.scenes.length >= 2);
  assert.ok(validation.ok);
});

test("a detailed script retains required events and exact dialogue", async () => {
  const planner = createMockPlanner();
  const input = `[SCRIPT]
INT. ROOM
EXACT: Maya: I can't keep doing this.
She sits with the letter, then opens the door.`;
  const { develop } = await runDevelopPass(planner, {
    text: input,
    format: "9:16",
    durationSec: 30,
    language: "en",
    delegated: true,
  });
  assert.equal(develop.classification, "detailed_script");
  assert.equal(develop.requirements.exactDialogue[0]?.line, "I can't keep doing this.");
  assert.ok(develop.script.scenes.some((scene) => scene.dialogue.some((line) => line.line === "I can't keep doing this.")));
});

test("Claude and OpenAI planners share the same application schemas", async () => {
  const original = process.env.PLANNER_PROVIDER;
  const planner = createMockPlanner();
  process.env.PLANNER_PROVIDER = "claude";
  const claude = await planner.run({
    task: "develop",
    schema: DevelopOutputSchema,
    system: "test",
    input: "someone waiting",
  });
  process.env.PLANNER_PROVIDER = "openai";
  const openai = await planner.run({
    task: "develop",
    schema: DevelopOutputSchema,
    system: "test",
    input: "someone waiting",
  });
  process.env.PLANNER_PROVIDER = original;
  assert.deepEqual(Object.keys(claude.output), Object.keys(openai.output));
  assert.equal(claude.provider, "claude");
  assert.equal(openai.provider, "openai");
  StructureOutputSchema.parse(mockStructure());
});

test("a new camera angle preserves the established scene", async () => {
  const structure = mockStructure();
  const angle = structure.shots.find((shot) => shot.continuity === "new_angle");
  assert.ok(angle);
  const parent = structure.shots.find((shot) => shot.id === angle.dependsOn);
  assert.equal(parent?.sceneId, angle.sceneId);
  assert.ok(angle.refs.some((ref) => ref.targetKind === "character"));
  assert.ok(angle.refs.some((ref) => ref.targetKind === "location"));
});

test("a continuation connects to the accepted outgoing edit point", () => {
  const structure = mockStructure();
  const shot = structure.shots.find((entry) => entry.continuity === "continue_shot")!;
  const parent = structure.shots.find((entry) => entry.id === shot.dependsOn)!;
  const observation = {
    shotId: parent.id,
    assetId: "asset_1",
    outgoingEditSec: parent.editDurationSec - 0.4,
    completedActions: ["reached the door"],
    incompleteActions: ["opening the door"],
    deviations: [],
    boundaryOut: parent.boundaryOut,
  };
  const prompt = compileShotPrompt({
    brief: mockDevelop("x").brief,
    scene: structure.scenes[1]!,
    shot,
    observation,
    characterNotes: ["Maya in the olive sweater"],
    locationNotes: "apartment door",
  });
  assert.match(prompt, /accepted outgoing moment/i);
  assert.match(prompt, /opening the door/);
  assert.equal(observation.outgoingEditSec, parent.editDurationSec - 0.4);
});

test("music and ambience remain continuous across visual cuts", () => {
  const structure = mockStructure();
  const music = structure.audioSegments.find((segment) => segment.track === "music")!;
  const ambience = structure.audioSegments.find((segment) => segment.track === "ambience")!;
  assert.ok(music.shotIds.length > 1);
  assert.ok(ambience.shotIds.length > 1);
  assert.deepEqual(music.shotIds, structure.shots.map((shot) => shot.id));
});

test("visible speech follows speech, then video, then sync with sync_mode", async () => {
  resetMockAdapters();
  const adapters = mockAdapterSet();
  assert.equal(nextLipsyncStep([]), "speech");
  assert.equal(nextLipsyncStep(["speech"]), "shot_video");
  assert.equal(nextLipsyncStep(["speech", "shot_video"]), "lipsync");
  const failed = await adapters.lipsync.submit({ modelId: "sync-3", prompt: "x" }, "k1");
  assert.equal(failed.status, "failed");
  const ok = await adapters.lipsync.submit({ modelId: "sync-3", prompt: "x", syncMode: "cut_off" }, "k2");
  assert.equal(ok.status, "completed");
});

test("unsupported feature combinations fail before paid generation", () => {
  const model = defaultVideoCapability();
  const issues = checkCapabilityCombo(model, {
    firstFrame: true,
    lastFrame: false,
    referenceImages: true,
    extension: true,
    standaloneAudioRef: false,
    interactionContext: true,
  });
  assert.ok(issues.some((issue) => issue.severity === "error"));
  const plan = { develop: mockDevelop("delegate someone waiting"), structure: mockStructure() };
  const result = preflight(plan, { budgetUsd: 15, estimatedUsd: 1, videoModelId: "video-omni" });
  assert.equal(result.ok, false);
  const repaired = repairPreflightStructure(plan.structure, result.issues);
  assert.ok(repaired.shots.some((shot) => shot.continuity === "continue_shot" && !shot.refs.some((ref) => ref.role === "subject_ref" || ref.role === "style_ref")));
  const second = preflight({ develop: plan.develop, structure: repaired }, { budgetUsd: 15, estimatedUsd: 1, videoModelId: "video-omni" });
  assert.equal(second.ok, true);
  plan.structure.shots[0]!.generationDurationSec = 120;
  const duration = preflight(plan, { budgetUsd: 15, estimatedUsd: 1, videoModelId: "video-omni" });
  assert.equal(duration.ok, false);
  assert.ok(duration.issues.some((issue) => issue.code === "duration_unsupported"));
});

test("a structure retry drops the unverified Omni combo", async () => {
  const planner = createMockPlanner();
  const structured = await runStructurePass(planner, mockDevelop("delegate someone waiting"), {
    retryNotes: "Omni does not verify first-frame, extra reference images, and extension in one request.",
  });
  const result = preflight(
    { develop: mockDevelop("delegate someone waiting"), structure: structured.structure },
    { budgetUsd: 15, estimatedUsd: 1, videoModelId: "video-omni" },
  );
  assert.equal(result.ok, true);
});

test("full-sequence extension outputs do not duplicate existing footage", () => {
  const applied = applyExtension(["a", "b"], "c", "full");
  assert.deepEqual(applied.keep, []);
  assert.deepEqual(applied.replace, ["a", "b"]);
  assert.equal(applied.selected, "c");
  const append = applyExtension(["a"], "c", "new_only");
  assert.deepEqual(append.keep, ["a"]);
});

test("resumed jobs poll instead of resubmitting", async () => {
  resetMockAdapters();
  const adapters = mockAdapterSet();
  const first = await adapters.video.submit({ modelId: "gemini-omni-1.1-flash", prompt: "walk" }, "same-key");
  const second = await adapters.video.submit({ modelId: "gemini-omni-1.1-flash", prompt: "walk" }, "same-key");
  assert.equal(first.providerJobId, second.providerJobId);
  assert.equal(decideSubmit({ status: "in_progress", providerJobId: first.providerJobId }), "poll");
  assert.equal(decideSubmit({ status: "submitting", providerJobId: null }), "needs_reconcile");
});

test("revisions invalidate the affected dependencies", () => {
  const result = invalidate(
    ["char_maya"],
    [
      { fromId: "char_maya", fromKind: "character", toId: "shot:shot_1", toKind: "shot" },
      { fromId: "shot:shot_1", fromKind: "shot", toId: "shot:shot_3", toKind: "shot" },
      { fromId: "aud_music", fromKind: "audio", toId: "assemble", toKind: "timeline" },
    ],
  );
  assert.ok(result.staleIds.includes("shot:shot_1"));
  assert.ok(result.staleIds.includes("shot:shot_3"));
  assert.ok(!result.staleIds.includes("assemble"));
});

test("exported media matches the intended timeline", async () => {
  const clips = [
    { id: "v1", shotId: "shot_1", assetId: "a1", kind: "video" as const, startSec: 0, durationSec: 8, trimInSec: 0, trimOutSec: 8, volume: 0, fadeInSec: 0, fadeOutSec: 0, transition: "cut" as const },
    { id: "m1", shotId: "shot_1", assetId: "a2", kind: "audio" as const, startSec: 0, durationSec: 22, trimInSec: 0, trimOutSec: 22, volume: 0.3, fadeInSec: 1, fadeOutSec: 2, transition: null },
  ];
  const production = { fps: 30, width: 1080, height: 1920, clips, durationSec: 22 };
  const check = validateProductionTimeline(production);
  assert.equal(check.ok, true);
  assert.equal(timelineDuration(clips), 22);
  const editor = compileToEditorTimeline(production, "9:16", [
    { id: "a1", kind: "video", name: "shot" },
    { id: "a2", kind: "audio", name: "music" },
  ]);
  assert.equal(editor.assets[0]?.source.type, "production");
  assert.equal(TimelineSchema.parse(editor).format, "9:16");
  const videoItem = editor.tracks[0]?.items[0];
  assert.equal(videoItem?.kind, "video");
  assert.equal(videoItem?.durationInFrames, 240);
  const audioTracks = editor.tracks.filter((track) => track.kind === "audio");
  assert.equal(audioTracks.length, 1);
  assert.equal(audioTracks[0]?.items[0]?.kind, "audio");
  const layered = compileToEditorTimeline(
    {
      ...production,
      clips: [
        ...clips,
        { id: "d1", shotId: "shot_1", assetId: "a3", kind: "audio" as const, startSec: 1, durationSec: 3, trimInSec: 0, trimOutSec: 3, volume: 1, fadeInSec: 0, fadeOutSec: 0, transition: null },
      ],
    },
    "9:16",
    [
      { id: "a1", kind: "video", name: "shot" },
      { id: "a2", kind: "audio", name: "music" },
      { id: "a3", kind: "audio", name: "dialogue" },
    ],
  );
  assert.equal(layered.tracks.filter((track) => track.kind === "audio").length, 2);

  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-timeline-"));
  const file = path.join(dir, "clip.mp4");
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:d=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-shortest",
      file,
    ]);
    const media = await checkMediaFile(file, { durationSec: 2, hasVideo: true });
    assert.equal(media.ok, true);
    assert.ok(media.probe?.hasAudio);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("questions are skipped when the user delegates creative choices", async () => {
  const planner = createMockPlanner();
  const { develop } = await runDevelopPass(planner, {
    text: "delegate a quiet apartment story",
    format: "9:16",
    durationSec: 30,
    language: "en",
    delegated: true,
  });
  assert.equal(needsUserQuestions(develop, true), false);
  const answered = applyAnswers(develop, { q_ending: "Open it" });
  assert.equal(answered.questions.questions[0]?.answer ?? "Open it", "Open it");
});

test("shot graph generates speech before continuations", () => {
  const steps = plannedStepsAfterApprove(mockStructure());
  const speech = steps.find((step) => step.kind === "speech");
  const continuation = steps.find((step) => step.kind === "shot_video" && step.targetKey === "shot:shot_3");
  assert.ok(speech);
  assert.ok(continuation?.dependsOnKeys.includes("review_shot:shot:shot_2"));
  assert.ok(continuation?.dependsOnKeys.includes("speech:speech:aud_dialogue_1"));
});

test("transcript comparison treats low confidence as uncertain", () => {
  const sure = compareTranscript("I can't keep doing this.", "I can't keep doing this.", 0.95);
  assert.equal(sure.ok, true);
  const unsure = compareTranscript("hello", "yellow", 0.2);
  assert.equal(unsure.uncertain, true);
});

void writeFile;
