import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_PRESET,
  AUTO_PRESET_ID,
  GENERATION_PRESETS,
  PRESET_IDS,
  defaultPresetIdFor,
  isPresetId,
  listPresetsFor,
  presetById,
  presetPosterFile,
  withVisualStyle,
} from "./presets";

test("catalog ids are unique and every footage preset has a style block", () => {
  const ids = new Set<string>();
  for (const preset of GENERATION_PRESETS) {
    assert.equal(ids.has(preset.id), false, preset.id);
    ids.add(preset.id);
    assert.ok(preset.name);
    assert.ok(preset.tagline);
    assert.ok(preset.poster.from && preset.poster.to);
    if (preset.appliesTo !== "motion") {
      assert.ok(preset.promptFragment.length > 20, preset.id);
    }
  }
  assert.equal(isPresetId(AUTO_PRESET_ID), true);
  assert.equal(PRESET_IDS.length, GENERATION_PRESETS.length + 1);
});

test("listPresetsFor keeps Auto and filters by engine", () => {
  const footage = listPresetsFor("footage");
  const motion = listPresetsFor("motion");
  assert.equal(footage[0]?.id, AUTO_PRESET_ID);
  assert.equal(motion[0]?.id, AUTO_PRESET_ID);
  assert.ok(footage.some((preset) => preset.id === "pixar"));
  assert.equal(
    footage.some((preset) => preset.id === "bold"),
    false,
  );
  assert.ok(motion.some((preset) => preset.id === "bold"));
  assert.equal(presetById("unknown"), null);
  assert.equal(defaultPresetIdFor("footage"), "default");
  assert.equal(defaultPresetIdFor("motion"), "bold");
});

test("poster files follow the visible preset name", () => {
  const file = (id: string) => presetPosterFile(presetById(id)!.name);
  assert.equal(file("minecraft"), "block-world.png");
  assert.equal(file("lego"), "brick-build.png");
  assert.equal(file("ghibli"), "painterly-storybook.png");
  assert.equal(file("papercraft"), "papercraft-diorama.png");
  assert.equal(file("nintendo"), "playful-adventure.png");
  assert.equal(file("zack-d-3d"), "stylized-3d.png");
  assert.equal(file("gta"), "sun-bleached-city.png");
  assert.equal(file("pixar"), "rounded-3d.png");
  assert.equal(file("3d-render"), "3d-render.png");
  assert.equal(file("ultra-realism"), "ultra-realism.png");

  const files = [AUTO_PRESET, ...GENERATION_PRESETS].map((preset) => presetPosterFile(preset.name));
  assert.equal(new Set(files).size, files.length);
});

test("withVisualStyle appends the fragment and direction once", () => {
  const pixar = presetById("pixar");
  assert.ok(pixar);
  const once = withVisualStyle("A fox walks through snow", pixar, "Keep the camera at eye level.");
  assert.match(once, /A fox walks through snow/);
  assert.match(once, /Soft rounded 3D animation/);
  assert.match(once, /Avoid:/);
  assert.match(once, /Visual direction for every scene: Keep the camera at eye level/);
  assert.equal(withVisualStyle(once, pixar, "Keep the camera at eye level."), once);
});

test("Auto only appends a visual direction", () => {
  const auto = presetById(AUTO_PRESET_ID);
  assert.equal(withVisualStyle("A fox walks through snow", auto), "A fox walks through snow");
  assert.match(withVisualStyle("A fox walks through snow", auto, "Warm light"), /Warm light/);
});
