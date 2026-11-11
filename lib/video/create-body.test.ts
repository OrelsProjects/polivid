import assert from "node:assert/strict";
import test from "node:test";
import { buildCreateBody, type CreateFormValues } from "./create-body";
import { CreateVideoSchema } from "./create-schema";

const values: CreateFormValues = {
  prompt: "  A lighthouse at dawn.  ",
  format: "9:16",
  length: 10,
  tier: "pro",
  model: "hailuo",
  mediaKey: null,
  referenceKeys: [],
  showText: true,
  presetId: "auto",
  visualDirection: "",
  characterId: "off",
  direction: "",
  scene: "",
  directionKeys: [],
  sceneKeys: [],
};

test("the plain create page sends a model and no mode", () => {
  const body = buildCreateBody({ mode: null, values, usesVideoModel: true });
  assert.deepEqual(body, {
    prompt: "A lighthouse at dawn.",
    format: "9:16",
    length: 10,
    model: "hailuo",
    showText: true,
    presetId: "auto",
    visualDirection: "",
    characterId: "off",
  });
  assert.equal(CreateVideoSchema.safeParse(body).success, true);
});

test("a mode sends its tier, and its tool only when the tool is not the mode itself", () => {
  const plain = buildCreateBody({ mode: "prompt", tool: "prompt", values, usesVideoModel: true });
  assert.equal(plain.mode, "prompt");
  assert.equal(plain.tier, "pro");
  assert.equal(plain.model, "hailuo");
  assert.equal("tool" in plain, false);
  const ad = buildCreateBody({ mode: "prompt", tool: "product-ad", values, usesVideoModel: true });
  assert.equal(ad.tool, "product-ad");
  assert.equal(CreateVideoSchema.safeParse(ad).success, true);
});

test("a chat-model tier sends no footage model", () => {
  const body = buildCreateBody({ mode: "motion-graphics", values, usesVideoModel: false });
  assert.equal("model" in body, false);
  assert.equal("characterId" in body, false, "motion graphics has no narrator to pick");
});

test("uploads go only to modes that need one", () => {
  const withFile = { ...values, mediaKey: "uploads/u1/clip.mp4" };
  const captions = buildCreateBody({ mode: "captions", values: withFile, usesVideoModel: true });
  assert.equal(captions.mediaKey, "uploads/u1/clip.mp4");
  assert.equal(captions.imageKey, "uploads/u1/clip.mp4");
  const prompt = buildCreateBody({ mode: "prompt", values: withFile, usesVideoModel: true });
  assert.equal("mediaKey" in prompt, false);
});

test("reference pictures are dropped by modes that cannot use them", () => {
  const withPictures = { ...values, referenceKeys: ["uploads/u1/a.png", "uploads/u1/b.png"] };
  assert.deepEqual(buildCreateBody({ mode: "prompt", values: withPictures, usesVideoModel: true }).referenceKeys, [
    "uploads/u1/a.png",
    "uploads/u1/b.png",
  ]);
  assert.equal("referenceKeys" in buildCreateBody({ mode: "voiceover", values: withPictures, usesVideoModel: true }), false);
});

test("lyrics send the director notes, the song take, and the approved cuts", () => {
  const body = buildCreateBody({
    mode: "lyrics",
    values: { ...values, direction: "Slow push in.", scene: "A rooftop.", sceneKeys: ["uploads/u1/roof.png"] },
    usesVideoModel: true,
    songId: "3f2b1c9e-8d4a-4b6f-9c1e-2a7d5e6f8b90",
    plan: { cuts: [{ seconds: 5, camera: "Wide", images: [] }, { seconds: 5, camera: "Close", images: [1] }] },
  });
  assert.equal(body.direction, "Slow push in.");
  assert.equal(body.scene, "A rooftop.");
  assert.deepEqual(body.sceneKeys, ["uploads/u1/roof.png"]);
  assert.equal("directionKeys" in body, false);
  assert.equal(body.songId, "3f2b1c9e-8d4a-4b6f-9c1e-2a7d5e6f8b90");
  assert.deepEqual(body.cuts, [
    { seconds: 5, camera: "Wide" },
    { seconds: 5, camera: "Close", images: [1] },
  ]);
  assert.equal("brief" in body, false, "only prompt videos carry a brief");
  assert.equal(CreateVideoSchema.safeParse(body).success, true);
});

test("a planned prompt video carries how the prompt was read", () => {
  const brief = { subject: "A lighthouse", setting: "Coast", director: "", style: "", mustKeep: "", mustAvoid: "" };
  const body = buildCreateBody({
    mode: "prompt",
    values,
    usesVideoModel: true,
    plan: { cuts: [{ seconds: 10, camera: "Wide" }], brief, attachmentRoles: [] },
  });
  assert.deepEqual(body.brief, brief);
  assert.deepEqual(body.attachmentRoles, []);
});

test("animated stills send the media and no footage model", () => {
  const body = buildCreateBody({
    mode: "voiceover",
    tool: "script-to-video",
    values: { ...values, media: "stills", verbatim: true, characterId: "studio" },
    usesVideoModel: false,
  });
  assert.equal(body.media, "stills");
  assert.equal(body.verbatim, true);
  assert.equal("model" in body, false);
  assert.equal(body.tool, "script-to-video");
  assert.equal(CreateVideoSchema.safeParse(body).success, true);
});

test("a mode that is always filmed ignores a stills or word-for-word setting", () => {
  const body = buildCreateBody({
    mode: "prompt",
    values: { ...values, media: "stills", verbatim: true },
    usesVideoModel: true,
  });
  assert.equal("media" in body, false);
  assert.equal("verbatim" in body, false);
  assert.equal(body.model, "hailuo");
});

test("a loop video sends its background: the uploaded clip when there is one, else the built-in", () => {
  const loop = { ...values, media: "loop" as const, verbatim: true, characterId: "studio" };
  const builtIn = buildCreateBody({ mode: "voiceover", tool: "story", values: { ...loop, backgroundId: "ember" }, usesVideoModel: false });
  assert.equal(builtIn.media, "loop");
  assert.equal(builtIn.backgroundId, "ember");
  assert.equal("backgroundKey" in builtIn, false);
  assert.equal("model" in builtIn, false);
  assert.equal(CreateVideoSchema.safeParse(builtIn).success, true);
  const own = buildCreateBody({
    mode: "voiceover",
    values: { ...loop, backgroundId: "ember", backgroundKey: "uploads/u1/rain.mp4" },
    usesVideoModel: false,
  });
  assert.equal(own.backgroundKey, "uploads/u1/rain.mp4");
  assert.equal("backgroundId" in own, false);
  const fallback = buildCreateBody({ mode: "voiceover", values: loop, usesVideoModel: false });
  assert.equal(fallback.backgroundId, "aurora");
});

test("only a loop video sends a background", () => {
  const body = buildCreateBody({
    mode: "voiceover",
    values: { ...values, media: "stills", backgroundId: "ember", backgroundKey: "uploads/u1/rain.mp4" },
    usesVideoModel: false,
  });
  assert.equal("backgroundId" in body, false);
  assert.equal("backgroundKey" in body, false);
});

test("a quick edit sends the upload, the edit, and a setting that is on the list", () => {
  const body = buildCreateBody({
    mode: "edit",
    tool: "rotate-video",
    values: { ...values, mediaKey: "uploads/u1/clip.mp4", op: "rotate", opValue: "270" },
    usesVideoModel: false,
  });
  assert.equal(body.mode, "edit");
  assert.equal(body.op, "rotate");
  assert.equal(body.opValue, "270");
  assert.equal(body.mediaKey, "uploads/u1/clip.mp4");
  assert.equal(body.tool, "rotate-video");
  assert.equal("model" in body, false);
  assert.equal(CreateVideoSchema.safeParse(body).success, true);
  const odd = buildCreateBody({
    mode: "edit",
    values: { ...values, mediaKey: "uploads/u1/clip.mp4", op: "loop", opValue: "99" },
    usesVideoModel: false,
  });
  assert.equal(odd.opValue, "3", "an unlisted setting falls back to the default");
});

test("a direct prompt sends the prompt as typed, with no voice and no pictures", async () => {
  const { buildCreateBody } = await import("./create-body");
  const typed = "Macro shot, 85mm. A wasp lands on a peach.\n  Camera holds. No cuts.";
  const body = buildCreateBody({
    mode: "direct",
    values: {
      prompt: typed,
      format: "16:9",
      length: 10,
      tier: "low",
      model: "wan",
      showText: true,
      presetId: "auto",
      visualDirection: "",
      characterId: "studio",
      referenceKeys: ["uploads/u1/images/a.png"],
    } as never,
    usesVideoModel: true,
  }) as Record<string, unknown>;
  assert.equal(body.prompt, typed.trim());
  assert.equal(body.mode, "direct");
  assert.equal(body.model, "wan");
  assert.equal("characterId" in body, false, "no voice is sent");
  assert.equal("referenceKeys" in body, false, "no pictures are sent");
  assert.equal("cuts" in body, false, "no shot plan is sent");
});
