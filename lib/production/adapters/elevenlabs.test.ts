import assert from "node:assert/strict";
import test from "node:test";
import { isElevenLabsPaidPlanRequired, musicComposeBody, sfxGenerationBody, voiceAddMessage } from "./elevenlabs";

test("voice errors preserve provider validation details instead of blaming the recording", () => {
  const detail = JSON.stringify({ detail: [{ loc: ["body", "text"], msg: "String should have at least 100 characters", input: "private text" }] });
  const message = voiceAddMessage(422, detail);
  assert.match(message, /text.*at least 100 characters/);
  assert.doesNotMatch(message, /private text|too quiet/);
});

test("voice errors preserve verification requirements and handle non-JSON failures", () => {
  assert.match(voiceAddMessage(403, JSON.stringify({ detail: { message: "Speaker verification required" } })), /Speaker verification required/);
  assert.equal(voiceAddMessage(502, "<html>upstream error</html>"), "Couldn't create that voice (502).");
  assert.equal(voiceAddMessage(401, "private error detail"), "The voice service rejected the API key.");
});

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

test("sound effect length stays within ElevenLabs bounds", () => {
  assert.equal(sfxGenerationBody({ prompt: "x", durationSec: 0.2 }).duration_seconds, 0.5);
  assert.equal(sfxGenerationBody({ prompt: "x", durationSec: 45 }).duration_seconds, 30);
  assert.equal(sfxGenerationBody({ prompt: "x", durationSec: 1.5 }).duration_seconds, 1.5);
  assert.equal(sfxGenerationBody({ prompt: "x" }).duration_seconds, 2);
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
