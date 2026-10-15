import assert from "node:assert/strict";
import test from "node:test";
import { mockStructure } from "../planner";
import { assembleClips, assetsByStep } from "./assemble";

const steps = [
  { id: "s_speech", kind: "speech", targetKey: "speech:aud_dialogue_1" },
  { id: "s_v1", kind: "shot_video", targetKey: "shot:shot_1" },
  { id: "s_v2", kind: "shot_video", targetKey: "shot:shot_2" },
  { id: "s_v3", kind: "shot_video", targetKey: "shot:shot_3" },
  { id: "s_lip1", kind: "lipsync", targetKey: "shot:shot_1" },
  { id: "s_sfx", kind: "sfx", targetKey: "sfx:aud_sfx_door" },
  { id: "s_amb", kind: "ambience", targetKey: "ambience:aud_ambience" },
  { id: "s_music", kind: "music", targetKey: "music:aud_music" },
];

const jobs = [
  { id: "j_speech", stepId: "s_speech", providerJobId: null },
  { id: "j_v1", stepId: "s_v1", providerJobId: "gen-vid-1" },
  { id: "j_v2", stepId: "s_v2", providerJobId: "gen-vid-2" },
  { id: "j_v3", stepId: "s_v3", providerJobId: "gen-vid-3" },
  { id: "j_lip1", stepId: "s_lip1", providerJobId: null },
  { id: "j_sfx", stepId: "s_sfx", providerJobId: null },
  { id: "j_amb", stepId: "s_amb", providerJobId: null },
  { id: "j_music", stepId: "s_music", providerJobId: null },
];

// Saved in the order providers finished, which is not the order of the plan.
const assets = [
  { id: "a_speech", kind: "audio", producedByJobId: "j_speech" },
  { id: "a_v1", kind: "video", producedByJobId: "gen-vid-1" },
  { id: "a_v2", kind: "video", producedByJobId: "gen-vid-2" },
  { id: "a_v3", kind: "video", producedByJobId: "gen-vid-3" },
  { id: "a_v3_dup", kind: "video", producedByJobId: "gen-vid-3" },
  { id: "a_sfx", kind: "audio", producedByJobId: "j_sfx" },
  { id: "a_amb", kind: "audio", producedByJobId: "j_amb" },
  { id: "a_music", kind: "audio", producedByJobId: "j_music" },
];

const clipAsset = (clips: ReturnType<typeof assembleClips>, id: string) => clips.find((clip) => clip.id === id)?.assetId;

test("clips are matched to the step that produced each asset, not to list order", () => {
  const clips = assembleClips(mockStructure(), assetsByStep(assets, jobs, steps));
  assert.equal(clipAsset(clips, "clip_shot_1"), "a_v1");
  assert.equal(clipAsset(clips, "clip_shot_2"), "a_v2");
  assert.equal(clipAsset(clips, "clip_shot_3"), "a_v3_dup");
  assert.equal(clipAsset(clips, "clip_aud_music"), "a_music");
  assert.equal(clipAsset(clips, "clip_aud_ambience"), "a_amb");
  assert.equal(clipAsset(clips, "clip_aud_sfx_door"), "a_sfx");
  assert.equal(clipAsset(clips, "clip_aud_dialogue_1"), "a_speech");
  assert.equal(clips.filter((clip) => clip.kind === "video").length, 3);
});

test("lipsynced footage replaces the raw shot", () => {
  const withLipsync = [...assets, { id: "a_v1_lip", kind: "video", producedByJobId: "j_lip1" }];
  const clips = assembleClips(mockStructure(), assetsByStep(withLipsync, jobs, steps));
  assert.equal(clipAsset(clips, "clip_shot_1"), "a_v1_lip");
  assert.equal(clipAsset(clips, "clip_shot_2"), "a_v2");
});

test("segments without audio are left out instead of borrowing another file", () => {
  const partial = assets.filter((asset) => asset.id !== "a_music");
  const clips = assembleClips(mockStructure(), assetsByStep(partial, jobs, steps));
  assert.equal(clipAsset(clips, "clip_aud_music"), undefined);
  assert.equal(clipAsset(clips, "clip_aud_dialogue_1"), "a_speech");
});
