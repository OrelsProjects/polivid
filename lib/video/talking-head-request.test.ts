import assert from "node:assert/strict";
import test from "node:test";
import { generationModelById, modelFitsMode } from "./models";
import { cropForFormat, MOTION_PROMPT_LIMIT, talkingHeadBody, talkingHeadMotion, ugcStillPrompt } from "./talking-head-request";

test("Avatar 6 is sent only the fields OpenRouter lists, with the picture and voice as references", () => {
  const body = talkingHeadBody({
    model: "heygen/heygen-avatar-6",
    prompt: "Talks to camera.",
    resolution: "1080p",
    imageUrl: "data:image/jpeg;base64,AAAA",
    audioUrl: "https://example.com/speech.mp3",
  });
  assert.deepEqual(Object.keys(body).sort(), ["input_references", "model", "prompt", "resolution"]);
  assert.deepEqual(body.input_references, [
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
    { type: "audio_url", audio_url: { url: "https://example.com/speech.mp3" } },
  ]);
});

test("the motion prompt is only what the person wrote", () => {
  assert.equal(talkingHeadMotion("Walks through a kitchen, pointing at the stove."), "Walks through a kitchen, pointing at the stove.");
  assert.equal(talkingHeadMotion("x".repeat(5000)).length, MOTION_PROMPT_LIMIT);
  // Avatar 6 needs a prompt. With nothing written it is only told to speak, with no props or style added.
  assert.equal(talkingHeadMotion(""), "The person speaks to the camera.");
  assert.equal(talkingHeadMotion(undefined), "The person speaks to the camera.");
});

test("a UGC still adds nothing the person didn't give", () => {
  const bare = ugcStillPrompt({ hasProduct: false });
  assert.doesNotMatch(bare, /product|selfie|room|setting|hold/i);
  // Neutral about what the character is: a cartoon stays a cartoon, and no style is added.
  assert.equal(bare, "The character is the one in the subject reference pictures. Keep the same look and art style.");
  assert.doesNotMatch(bare, /person|face|hair|skin|photo|realistic|cartoon/i);
  assert.match(ugcStillPrompt({ hasProduct: true }), /product from the last reference picture/);
  assert.match(ugcStillPrompt({ hasProduct: false, direction: "On a beach at sunset." }), /On a beach at sunset\.$/);
});

test("a picture is cropped to the video's shape, with even sides, keeping the top of a portrait", () => {
  assert.deepEqual(cropForFormat(1024, 1024, "9:16"), { width: 576, height: 1024, x: 224, y: 0 });
  assert.deepEqual(cropForFormat(1080, 1920, "1:1"), { width: 1080, height: 1080, x: 0, y: 280 });
  assert.deepEqual(cropForFormat(1920, 1080, "16:9"), { width: 1920, height: 1080, x: 0, y: 0 });
});

test("talking-head models film only avatar and UGC, and those modes film with nothing else", () => {
  const avatar = generationModelById("avatar-6");
  const wan = generationModelById("wan");
  assert.ok(avatar && wan);
  assert.equal(modelFitsMode(avatar, "avatar"), true);
  assert.equal(modelFitsMode(avatar, "ugc"), true);
  assert.equal(modelFitsMode(avatar, "prompt"), false);
  assert.equal(modelFitsMode(avatar, undefined), false);
  assert.equal(modelFitsMode(wan, "avatar"), false);
  assert.equal(modelFitsMode(wan, "shorts"), true);
});
