import assert from "node:assert/strict";
import test from "node:test";
import {
  fallbackCuts,
  filmedSecondsForCuts,
  normalizeCuts,
  promptPlanFromOutput,
  promptPlanKey,
  promptShotPrompt,
  promptShotReferences,
  retimeCut,
  emptyPromptBrief,
} from "./shot-plan";

const WAN = Array.from({ length: 29 }, (_, index) => index + 2);
const HAILUO = Array.from({ length: 11 }, (_, index) => index + 5);

const baseKey = {
  prompt: "A fox crossing a snowy road",
  length: 12,
  tier: "pro",
  format: "9:16",
  references: ["uploads/a.jpg"],
  presetId: "movie",
  visualDirection: "Warm light",
  characterId: "off",
};

test("a failed prompt plan falls back to equal cuts and an empty brief", () => {
  const plan = promptPlanFromOutput(null, { length: 13, durations: WAN, referenceCount: 2 });
  assert.deepEqual(emptyPromptBrief(), plan.brief);
  assert.deepEqual(
    plan.cuts.map((cut) => cut.seconds),
    [13],
  );
  assert.ok(plan.cuts.every((cut) => cut.camera === ""));
  assert.equal(
    plan.cuts.reduce((sum, cut) => sum + cut.seconds, 0),
    13,
  );
  assert.deepEqual(plan.attachmentRoles, [
    { index: 1, role: "subject" },
    { index: 2, role: "location" },
  ]);
});

test("prompt cuts are resized to the video and cannot outrun the model", () => {
  const plan = promptPlanFromOutput(
    {
      subject: "A rust-orange fox",
      cuts: [
        { seconds: 40, camera: "wide shot, fox runs, wet road", images: [1, 9] },
        { seconds: 4, camera: "close-up, fox stops, neon sign" },
      ],
    },
    { length: 12, durations: HAILUO, referenceCount: 1 },
  );
  assert.equal(plan.brief.subject, "A rust-orange fox");
  assert.equal(
    plan.cuts.reduce((sum, cut) => sum + cut.seconds, 0),
    12,
  );
  assert.ok(plan.cuts.every((cut) => cut.seconds <= 15));
  assert.equal(plan.cuts[0]?.camera, "wide shot, fox runs, wet road");
  assert.deepEqual(plan.cuts[0]?.images, [1]);
  assert.equal(filmedSecondsForCuts(12, HAILUO, plan.cuts) >= 12, true);
});

test("a one second prompt cut is filmed at the model minimum", () => {
  const cuts = Array.from({ length: 10 }, () => ({ seconds: 1, camera: "new angle" }));
  assert.equal(filmedSecondsForCuts(10, HAILUO, cuts), 50);
  assert.ok(filmedSecondsForCuts(10, HAILUO, cuts) > filmedSecondsForCuts(10, HAILUO, [{ seconds: 10, camera: "wide" }]));
});

test("fallback cuts stay inside the model cap", () => {
  const cuts = fallbackCuts(40, HAILUO, 15);
  assert.equal(
    cuts.reduce((sum, cut) => sum + cut.seconds, 0),
    40,
  );
  assert.ok(cuts.every((cut) => cut.seconds <= 15));
});

test("retiming a prompt cut keeps its pictures", () => {
  const cuts = retimeCut(
    [
      { seconds: 2, camera: "wide", images: [1, 2] },
      { seconds: 2, camera: "close" },
      { seconds: 2, camera: "overhead" },
    ],
    0,
    4,
    6,
    15,
  );
  assert.equal(cuts[0]?.seconds, 4);
  assert.deepEqual(cuts[0]?.images, [1, 2]);
  assert.equal(
    cuts.reduce((sum, cut) => sum + cut.seconds, 0),
    6,
  );
  assert.deepEqual(
    normalizeCuts([{ seconds: 3, camera: "wide", images: [2] }], 3).map((cut) => cut.images),
    [[2]],
  );
});

test("prompt pictures are ordered subject, then place, then framing", () => {
  const plan = promptShotReferences({
    keys: ["wide", "fox", "roof"],
    roles: [
      { index: 1, role: "framing" },
      { index: 2, role: "subject" },
      { index: 3, role: "location" },
    ],
  });
  assert.deepEqual(plan.keys, ["fox", "roof", "wide"]);
  assert.equal(
    plan.note,
    "Image 1 is the subject. Keep that exact subject. Image 2 shows the location: match the set and light. Image 3 shows framing: copy the camera and composition, not the people.",
  );
  const shot = promptShotReferences({
    keys: ["wide", "fox", "roof"],
    roles: [
      { index: 1, role: "framing" },
      { index: 2, role: "subject" },
      { index: 3, role: "location" },
    ],
    images: [2],
  });
  assert.deepEqual(shot.keys, ["fox"]);
  assert.match(shot.note, /Image 1 is the subject/);
  assert.doesNotMatch(shot.note, /location/);
});

test("a prompt shot films only its own beat", () => {
  const line = promptShotPrompt({
    brief: {
      subject: "Orel and the Alien",
      setting: "Corridor and escape pod",
      director: "Handheld",
      style: "",
      mustKeep: "the close button, the heavy door, the claw",
      mustAvoid: "On-screen text",
    },
    action: "Orel sprints down the red corridor while the Alien lunges behind him.",
    camera: "Wide tracking backward",
    referenceNote: "Image 1 is the storyboard frame for this shot. Match its framing, pose, and setting, and keep the same person.",
    fallbackAction: "The whole script with the pod and the door",
    continued: true,
    samePlace: false,
  });
  assert.match(line, /Action: Orel sprints down the red corridor/);
  assert.match(line, /Camera: Wide tracking backward/);
  assert.match(line, /keep the same person/);
  assert.doesNotMatch(line, /close button/);
  assert.doesNotMatch(line, /Scene:/);
  assert.doesNotMatch(line, /Keep:/);
  assert.doesNotMatch(line, /continues from the previous shot/);
  assert.doesNotMatch(line, /whole script/);
  const samePlace = promptShotPrompt({
    brief: emptyPromptBrief(),
    action: "Orel hits the close button.",
    camera: "Close on the button",
    referenceNote: "",
    fallbackAction: "The pod and the claw",
    continued: true,
    samePlace: true,
  });
  assert.match(samePlace, /continues from the previous shot/);
  assert.match(samePlace, /Action: Orel hits the close button/);
  assert.doesNotMatch(samePlace, /claw/);
});

test("a storyboard frame keeps the person", () => {
  const shot = promptShotReferences({
    keys: ["frame", "orel"],
    roles: [
      { index: 1, role: "storyboard" },
      { index: 2, role: "subject" },
    ],
    images: [1, 2],
  });
  assert.match(shot.note, /Image 2 is the storyboard frame/);
  assert.match(shot.note, /keep the same person/);
  assert.doesNotMatch(shot.note, /not the people/);
});

test("a prompt shot names the subject, the place, and the camera", () => {
  const line = promptShotPrompt({
    brief: {
      subject: "A rust-orange fox",
      setting: "A snowy road at dusk",
      director: "Handheld, warm light",
      style: "",
      mustKeep: "The fox stays rust-orange",
      mustAvoid: "No other animals",
    },
    camera: "crash zoom from wide to medium, fox runs, wet asphalt",
    referenceNote: "Image 1 is the subject. Keep that exact subject.",
    fallbackAction: "The whole original prompt",
    continued: false,
  });
  assert.match(line, /Subject: A rust-orange fox/);
  assert.match(line, /Scene: A snowy road at dusk/);
  assert.match(line, /Camera: crash zoom from wide to medium/);
  assert.doesNotMatch(line, /whole original prompt/);
  const continued = promptShotPrompt({
    brief: emptyPromptBrief(),
    camera: "",
    referenceNote: "",
    fallbackAction: "A fox crossing a road",
    continued: true,
  });
  assert.match(continued, /Action: A fox crossing a road/);
});

test("editing the prompt, pictures, length, look, or character invalidates the shot plan", () => {
  const key = promptPlanKey(baseKey);
  assert.equal(promptPlanKey({ ...baseKey, prompt: "  A fox crossing a snowy road  " }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, prompt: "A wolf" }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, length: 13 }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, tier: "low" }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, format: "16:9" }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, references: ["uploads/b.jpg"] }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, presetId: "pixar" }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, visualDirection: "Cold light" }), key);
  assert.notEqual(promptPlanKey({ ...baseKey, characterId: "studio" }), key);
});
