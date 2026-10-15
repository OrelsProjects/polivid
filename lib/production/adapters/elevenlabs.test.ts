import assert from "node:assert/strict";
import test from "node:test";
import { isElevenLabsPaidPlanRequired, musicComposeBody } from "./elevenlabs";

test("music compose uses a prompt instead of a composition plan", () => {
  const body = musicComposeBody({ prompt: "Sparse low strings that grow", durationSec: 22 });
  assert.equal(body.model_id, "music_v2_5");
  assert.equal(body.prompt, "Sparse low strings that grow");
  assert.equal(body.music_length_ms, 22_000);
  assert.equal(body.force_instrumental, true);
  assert.equal("composition_plan" in body, false);
});

test("music length stays within ElevenLabs bounds", () => {
  assert.equal(musicComposeBody({ prompt: "x", durationSec: 1 }).music_length_ms, 3_000);
  assert.equal(musicComposeBody({ prompt: "x", durationSec: 900 }).music_length_ms, 600_000);
});

test("ElevenLabs free-plan music errors fall back locally", () => {
  assert.equal(
    isElevenLabsPaidPlanRequired(
      new Error('ElevenLabs request failed (402). {"detail":{"code":"paid_plan_required","message":"Music API is not available for free users."}}'),
    ),
    true,
  );
  assert.equal(
    isElevenLabsPaidPlanRequired(
      new Error('ElevenLabs request failed (429). {"detail":{"code":"concurrent_limit_exceeded"}}'),
    ),
    true,
  );
  assert.equal(isElevenLabsPaidPlanRequired(new Error("ElevenLabs request failed (422). Field required")), false);
});
