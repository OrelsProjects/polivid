import assert from "node:assert/strict";
import test from "node:test";
import { formSpecFor } from "./form-spec";
import { videoModeById } from "./modes";
import { toolBySlug } from "./tool-catalog";

const spec = (modeId: string | null, slug?: string) =>
  formSpecFor(modeId ? videoModeById(modeId) : null, slug ? toolBySlug(slug) : null);

test("the plain create page shows the whole form and plans nothing first", () => {
  const plain = spec(null);
  assert.equal(plain.input, "prompt");
  assert.equal(plain.planFirst, null);
  assert.equal(plain.uploadKind, null);
  assert.equal(plain.presetIds, null);
  for (const section of ["references", "look", "showText", "visualDirection", "format", "length", "model", "character", "improve"] as const) {
    assert.ok(plain.sections.has(section), section);
  }
  assert.equal(plain.sections.has("tier"), false);
});

test("prompt and lyrics videos are approved before filming", () => {
  assert.equal(spec("prompt").planFirst, "shots");
  assert.equal(spec("prompt").sections.has("improve"), false);
  const lyrics = spec("lyrics");
  assert.equal(lyrics.planFirst, "song");
  assert.equal(lyrics.input, "lyrics");
  assert.equal(lyrics.sections.has("showText"), false);
  assert.equal(lyrics.sections.has("visualDirection"), false);
  assert.equal(spec("voiceover").planFirst, null);
});

test("upload modes ask for their file and keep their own sound", () => {
  assert.equal(spec("captions").uploadKind, "video");
  assert.equal(spec("music").uploadKind, "audio");
  assert.equal(spec("av-to-video").uploadKind, "media");
  assert.equal(spec("image").uploadKind, "image");
  assert.equal(spec("captions").sections.has("character"), false);
  assert.equal(spec("captions").sections.has("showText"), false);
  assert.equal(spec("captions").sections.has("references"), false);
  assert.equal(spec("image").sections.has("character"), true);
});

test("motion graphics has tiers but no footage model to pick", () => {
  const motion = spec("motion-graphics");
  assert.equal(motion.sections.has("tier"), true);
  assert.equal(motion.sections.has("model"), false);
  assert.equal(spec("prompt").sections.has("model"), true);
});

test("a presenter video takes a script", () => {
  assert.equal(spec("shorts").input, "script");
});

test("a tool narrows the form of its mode", () => {
  const loop = spec("prompt", "b-roll");
  assert.equal(loop.sections.has("character"), false);
  assert.equal(loop.sections.has("showText"), false);
  assert.equal(loop.planFirst, "shots");
  const ad = spec("prompt", "product-ad");
  assert.deepEqual(ad.presetIds, ["default", "ultra-realism", "realist", "photography", "movie"]);
  assert.equal(ad.sections.has("references"), true);
  assert.deepEqual([...spec("prompt", "prompt").sections].sort(), [...spec("prompt").sections].sort());
});

test("only a spoken-script mode offers stills and word-for-word reading", () => {
  assert.equal(spec("voiceover").sections.has("media"), true);
  assert.equal(spec("voiceover").sections.has("verbatim"), true);
  for (const id of ["prompt", "shorts", "lyrics", "music", "captions", "motion-graphics", "image", "avatar"]) {
    assert.equal(spec(id).sections.has("media"), false, id);
    assert.equal(spec(id).sections.has("verbatim"), false, id);
  }
  assert.equal(spec(null).sections.has("media"), false);
});

test("a link field comes with any spoken-script mode, and leads the form for link tools", () => {
  assert.equal(spec("voiceover").sections.has("link"), true);
  assert.equal(spec("voiceover").linkFirst, false);
  assert.equal(spec("voiceover", "article-to-video").linkFirst, true);
  assert.equal(spec("prompt").sections.has("link"), false);
  assert.equal(spec("prompt", "product-ad").linkFirst, false);
});

test("a loop tool hides the look, because nothing is drawn", () => {
  const story = spec("voiceover", "story");
  assert.equal(story.sections.has("look"), false);
  assert.equal(story.sections.has("visualDirection"), false);
  assert.equal(story.sections.has("media"), true);
  assert.equal(story.sections.has("character"), true);
  assert.equal(spec("voiceover", "post-to-video").linkFirst, true);
});

test("modes that work on an upload show no writing, look, length, or model", () => {
  for (const id of ["captions", "edit"]) {
    const form = spec(id);
    assert.equal(form.showPrompt, false, id);
    assert.equal(form.uploadKind, "video", id);
    for (const section of ["look", "format", "length", "tier", "model", "character", "references", "improve", "media"] as const) {
      assert.equal(form.sections.has(section), false, `${id} ${section}`);
    }
  }
  assert.equal(spec("edit").sections.has("op"), true);
  assert.equal(spec("captions").sections.has("op"), false);
  assert.equal(spec("edit", "rotate-video").lockOp, true);
  assert.equal(spec("edit").lockOp, false);
  assert.equal(spec("prompt").showPrompt, true);
});

test("a direct prompt asks only for what the model needs, and plans nothing", () => {
  const direct = spec("direct");
  assert.deepEqual([...direct.sections].sort(), ["format", "length", "model", "tier"]);
  assert.equal(direct.planFirst, null, "no shot plan to approve");
  assert.equal(direct.showPrompt, true);
  assert.equal(direct.uploadKind, null, "no pictures or files");
  assert.equal(direct.input, "prompt");
});
