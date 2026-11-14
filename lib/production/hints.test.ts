import assert from "node:assert/strict";
import test from "node:test";
import { mockStructure } from "./planner";
import {
  applyHintsToStructure,
  hintsNote,
  isProductionVideoModel,
  PRODUCTION_VIDEO_MODEL_IDS,
  readHints,
  shotModelSlug,
  shotUsdPerSecFor,
} from "./hints";

test("no hints leaves the plan and the prompt alone", () => {
  const structure = mockStructure();
  assert.equal(applyHintsToStructure(structure, {}), structure);
  assert.equal(hintsNote({}, "develop"), "");
  assert.equal(hintsNote(undefined, "structure"), "");
});

test("the planner note lists every rule for its pass", () => {
  const develop = hintsNote({ sceneSeconds: [10, 20], music: false, notes: "Keep it upbeat." }, "develop");
  assert.match(develop, /Exactly 2 script scenes/);
  assert.match(develop, /10, 20/);
  assert.match(develop, /No music segments/);
  assert.match(develop, /Keep it upbeat/);
  assert.doesNotMatch(hintsNote({ maxShotSec: 5 }, "develop"), /No shot longer/);
  assert.match(hintsNote({ maxShotSec: 5, narratorVoiceId: "Sarah" }, "structure"), /No shot longer than 5[\s\S]*voiceId Sarah/);
});

test("turning sound kinds off removes them from the plan and from the shots", () => {
  const structure = mockStructure();
  const before = structure.audioSegments.map((segment) => segment.track);
  assert.ok(before.includes("music") && before.includes("sfx") && before.includes("ambience"));
  const quiet = applyHintsToStructure(structure, { music: false, sfx: false, ambience: false });
  assert.deepEqual([...new Set(quiet.audioSegments.map((segment) => segment.track))].sort(), [
    ...new Set(before.filter((track) => track === "dialogue" || track === "narration")),
  ].sort());
  const kept = new Set(quiet.audioSegments.map((segment) => segment.id));
  for (const shot of quiet.shots) for (const id of shot.audioSegmentIds) assert.ok(kept.has(id));
});

test("maxShotSec caps every shot", () => {
  const capped = applyHintsToStructure(mockStructure(), { maxShotSec: 2 });
  for (const shot of capped.shots) {
    assert.ok(shot.editDurationSec <= 2);
    assert.ok(shot.generationDurationSec <= 2);
  }
});

test("a shot's own model wins over the production model, and only production models count", () => {
  assert.ok(PRODUCTION_VIDEO_MODEL_IDS.includes("happyhorse"));
  assert.equal(isProductionVideoModel("kling-4"), false);
  const hints = readHints({ videoModel: "wan", shotModels: { shot_2: "happyhorse" } });
  assert.equal(shotModelSlug("shot_1", hints), "alibaba/wan-3.0");
  assert.equal(shotModelSlug("shot_2", hints), "alibaba/happyhorse-1.1");
  assert.equal(shotModelSlug("shot_1", readHints({ videoModel: "kling-4" })), null);
  assert.equal(typeof shotUsdPerSecFor(hints)("shot_2"), "number");
  assert.equal(shotUsdPerSecFor({})("shot_1"), undefined);
});

test("bad stored hints read as none", () => {
  assert.deepEqual(readHints({ sceneCount: "lots" }), {});
  assert.deepEqual(readHints(null), {});
});
