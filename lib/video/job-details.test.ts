import assert from "node:assert/strict";
import test from "node:test";
import { jobDetailRows } from "./job-details";
import { readJobInput } from "./job-status";

const base = readJobInput({
  prompt: "A man walking down Paris",
  aspectRatio: "9:16",
  duration: 90,
  model: "alibaba/wan-3.0",
  mode: "prompt",
  tier: "pro",
  resolution: "720p",
  presetId: "default",
  visualDirection: "Warm evening light on the river.",
  characterId: "off",
});

test("describes the video model and the settings for this job", () => {
  const rows = jobDetailRows(base);
  const value = (label: string) => rows.find((row) => row.label === label)?.value;
  assert.equal(value("Name"), "Wan 3.0");
  assert.equal(value("Provider"), "OpenRouter");
  assert.equal(value("Model"), "alibaba/wan-3.0");
  assert.equal(value("Resolution"), "720p");
  assert.equal(value("Mode"), "Prompt to Video");
  assert.equal(value("Quality"), "Pro");
  assert.equal(value("Style"), "Default");
  assert.equal(value("Format"), "9:16");
  assert.equal(value("Length"), "90s");
  assert.match(value("Clips") ?? "", /clips/);
  assert.ok((value("Details") ?? "").length > 80);
  assert.equal(rows.some((row) => row.label === "Character"), false);
});

test("names a studio voice and a saved character", () => {
  const studio = jobDetailRows({ ...base, characterId: "studio" });
  assert.equal(studio.find((row) => row.label === "Character")?.value, "Studio voice");
  const saved = jobDetailRows({
    ...base,
    characterId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    characterName: "Mina",
  });
  assert.equal(saved.find((row) => row.label === "Character")?.value, "Mina");
});

test("a lyrics video names the song and whether the singer is lip-synced", () => {
  const rows = jobDetailRows({ ...base, mode: "lyrics", referenceKeys: ["uploads/user/face.png"] });
  assert.equal(rows.find((row) => row.label === "Song")?.value, "ElevenLabs Music");
  assert.equal(rows.find((row) => row.label === "Singer lip-sync")?.value, "On");
  const silent = jobDetailRows({ ...base, mode: "lyrics" });
  assert.equal(silent.find((row) => row.label === "Singer lip-sync")?.value, "Off");
});

test("uses a saved preset name when the style is not built in", () => {
  const rows = jobDetailRows({ ...base, presetId: "custom-1", presetName: "Night market" });
  assert.equal(rows.find((row) => row.label === "Style")?.value, "Night market");
});
