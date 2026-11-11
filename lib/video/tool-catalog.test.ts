import assert from "node:assert/strict";
import test from "node:test";
import { MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH } from "./schema";
import { backgroundById } from "./backgrounds";
import { modeAllowsMedia, resolveModeTier, VIDEO_MODES, videoModeById } from "./modes";
import { AUTO_PRESET_ID, presetById } from "./presets";
import {
  CREATE_TOOLS,
  FORM_SECTIONS,
  TOOL_CATEGORIES,
  featuredTools,
  isToolLive,
  toolBySlug,
  toolMatches,
} from "./tool-catalog";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Names the catalog must never carry: franchises, studios, platforms, and real-person formats. */
const DENIED = [
  "pixar",
  "ghibli",
  "disney",
  "marvel",
  "lego",
  "minecraft",
  "nintendo",
  "pokemon",
  "fortnite",
  "roblox",
  "naruto",
  "star wars",
  "harry potter",
  "gta",
  "reddit",
  "tiktok",
  "celebrity",
  "deepfake",
  "face swap",
  "faceswap",
];

test("slugs are unique and safe to put in a URL", () => {
  const seen = new Set<string>();
  for (const tool of CREATE_TOOLS) {
    assert.match(tool.slug, SLUG, tool.slug);
    assert.ok(tool.slug.length <= 60, tool.slug);
    assert.equal(seen.has(tool.slug), false, `duplicate ${tool.slug}`);
    seen.add(tool.slug);
  }
});

test("every mode is a tool under its own id, with the mode's copy", () => {
  for (const mode of VIDEO_MODES) {
    const tool = toolBySlug(mode.id);
    assert.ok(tool, mode.id);
    assert.equal(tool.mode, mode.id);
    assert.equal(tool.title, mode.title);
    assert.equal(tool.description, mode.description);
    assert.equal(tool.defaults, undefined, `${mode.id} must open exactly as before`);
  }
});

test("every tool points at a real mode and a real category", () => {
  const categories = new Set<string>(TOOL_CATEGORIES.map((category) => category.id));
  for (const tool of CREATE_TOOLS) {
    assert.ok(videoModeById(tool.mode), `${tool.slug} → ${tool.mode}`);
    assert.ok(categories.has(tool.category), `${tool.slug} category`);
    assert.ok(tool.title.trim().length > 2, tool.slug);
    assert.ok(tool.description.trim().length > 20, tool.slug);
    assert.ok(tool.keywords.length > 0, `${tool.slug} keywords`);
    assert.ok(isToolLive(tool), `${tool.slug} is listed but cannot run`);
  }
  for (const category of TOOL_CATEGORIES) {
    assert.ok(
      CREATE_TOOLS.some((tool) => tool.category === category.id),
      `${category.id} is empty`,
    );
  }
});

test("starting values are ones the mode can actually film", () => {
  for (const tool of CREATE_TOOLS) {
    const defaults = tool.defaults;
    if (!defaults) continue;
    const resolved = resolveModeTier(tool.mode, defaults.tier ?? "pro");
    assert.ok(resolved, `${tool.slug} tier`);
    if (defaults.length !== undefined) {
      assert.ok(Number.isInteger(defaults.length), tool.slug);
      assert.ok(defaults.length >= MIN_VIDEO_LENGTH && defaults.length <= MAX_VIDEO_LENGTH, `${tool.slug} length`);
      assert.ok(defaults.length < 100, `${tool.slug} length must fit the two-digit box`);
    }
    if (defaults.media) assert.ok(modeAllowsMedia(videoModeById(tool.mode), defaults.media), `${tool.slug} ${defaults.media}`);
    if (defaults.backgroundId) assert.ok(backgroundById(defaults.backgroundId), `${tool.slug} background`);
    if (defaults.verbatim) assert.ok(videoModeById(tool.mode)?.spokenScript, `${tool.slug} word for word`);
    if (defaults.format && resolved.model) {
      assert.ok(resolved.model.aspectRatios.includes(defaults.format), `${tool.slug} ${defaults.format}`);
    }
  }
});

test("looks named by a tool exist and suit the mode's engine", () => {
  for (const tool of CREATE_TOOLS) {
    const engine = videoModeById(tool.mode)?.engine === "motion" ? "motion" : "footage";
    const ids = [...(tool.presets ?? []), ...(tool.defaults?.presetId ? [tool.defaults.presetId] : [])];
    for (const id of ids) {
      if (id === AUTO_PRESET_ID) continue;
      const preset = presetById(id);
      assert.ok(preset, `${tool.slug} look ${id}`);
      assert.ok(preset.appliesTo === "both" || preset.appliesTo === engine, `${tool.slug} look ${id} is for ${preset.appliesTo}`);
    }
    if (tool.presets && tool.defaults?.presetId && tool.defaults.presetId !== AUTO_PRESET_ID) {
      assert.ok(tool.presets.includes(tool.defaults.presetId), `${tool.slug} default look is not offered`);
    }
    for (const section of tool.hide ?? []) {
      assert.ok((FORM_SECTIONS as readonly string[]).includes(section), `${tool.slug} hides ${section}`);
    }
  }
});

test("no tool is named after a franchise, a platform, or a real-person format", () => {
  for (const tool of CREATE_TOOLS) {
    const text = [tool.slug.replaceAll("-", " "), tool.title, tool.description, ...tool.keywords].join(" ").toLowerCase();
    for (const word of DENIED) {
      const inherited = toolBySlug(tool.mode) === tool;
      if (inherited && (word === "tiktok" || word === "reddit")) continue;
      assert.equal(text.includes(word), false, `${tool.slug} mentions "${word}"`);
    }
  }
});

test("search matches names, keywords, and categories", () => {
  const product = toolBySlug("product-ad");
  assert.ok(product);
  assert.equal(toolMatches(product, ""), true);
  assert.equal(toolMatches(product, "  ECOMMERCE "), true);
  assert.equal(toolMatches(product, "marketing"), true);
  assert.equal(toolMatches(product, "lyrics"), false);
  assert.equal(toolBySlug("nope"), null);
  assert.equal(toolBySlug(""), null);
  assert.ok(featuredTools().length >= 3);
});
