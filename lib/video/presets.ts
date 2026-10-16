export const PRESET_FAMILIES = [
  "animation3d",
  "illustration",
  "realism",
  "worlds",
  "educational",
  "motion",
] as const;
export type PresetFamily = (typeof PRESET_FAMILIES)[number];

export const PRESET_ENGINES = ["footage", "motion", "both"] as const;
export type PresetEngine = (typeof PRESET_ENGINES)[number];

export const AUTO_PRESET_ID = "auto";
export const DEFAULT_FOOTAGE_PRESET_ID = "default";
export const DEFAULT_MOTION_PRESET_ID = "bold";
export const MAX_VISUAL_DIRECTION = 600;
export const MAX_PRESET_NAME = 60;
export const MAX_PRESET_FRAGMENT = 800;

export interface PresetPoster {
  from: string;
  to: string;
  accent: string;
}

export interface GenerationPreset {
  id: string;
  name: string;
  family: PresetFamily;
  tagline: string;
  promptFragment: string;
  negativeFragment: string;
  motionNotes: string;
  bestFor: string[];
  poster: PresetPoster;
  appliesTo: PresetEngine;
}

const preset = (
  id: string,
  name: string,
  family: PresetFamily,
  tagline: string,
  promptFragment: string,
  negativeFragment: string,
  motionNotes: string,
  bestFor: string[],
  poster: PresetPoster,
  appliesTo: PresetEngine = "footage",
): GenerationPreset => ({
  id,
  name,
  family,
  tagline,
  promptFragment,
  negativeFragment,
  motionNotes,
  bestFor,
  poster,
  appliesTo,
});

export const AUTO_PRESET: GenerationPreset = preset(
  AUTO_PRESET_ID,
  "Auto",
  "realism",
  "Pick a style from the brief",
  "",
  "",
  "Choose one locked style and reuse it in every scene.",
  ["any topic", "when you are unsure"],
  { from: "#e8edf5", to: "#c5d0e0", accent: "#6b7c93" },
  "both",
);

export const GENERATION_PRESETS: readonly GenerationPreset[] = [
  preset(
    "pixar",
    "Rounded 3D",
    "animation3d",
    "Soft, expressive animated characters",
    "Soft rounded 3D animation, simplified forms, large expressive eyes with bright catchlights, subsurface scattering on skin, warm key light, shallow depth of field, hand-painted texture detail.",
    "photorealistic, hyperrealistic, 8k, sharp edges, flat 2D cartoon, anime linework",
    "Slow push-in or locked-off close coverage. One clear action per shot.",
    ["kids", "explainers", "character stories"],
    { from: "#f4d7b0", to: "#7eb8d4", accent: "#f2b14a" },
  ),
  preset(
    "zack-d-3d",
    "Stylized 3D",
    "animation3d",
    "Sculpted, graphic 3D with punchy color",
    "Highly stylized 3D character render, sculpted forms, graphic color blocking, glossy materials, studio rim light, crisp silhouette, limited but saturated palette.",
    "photoreal skin, muddy lighting, cluttered background, painterly 2D",
    "Orbit or gentle truck. Hold on a strong silhouette.",
    ["product reveals", "brand spots", "heroes"],
    { from: "#1b1b22", to: "#f25c54", accent: "#f6d365" },
  ),
  preset(
    "low-poly",
    "Low Poly",
    "animation3d",
    "Faceted geometry and a short palette",
    "Low-poly 3D render, faceted geometry, flat shading, four-colour palette, simple geometric facets, clean horizon, no texture noise.",
    "smooth subdivision, photoreal materials, dense foliage detail, film grain",
    "Locked or slow crane. Keep motion simple so facets read.",
    ["tech explainers", "maps", "playful ads"],
    { from: "#6ec1a6", to: "#2d4a5a", accent: "#f4d35e" },
  ),
  preset(
    "lego",
    "Brick Build",
    "animation3d",
    "Toy bricks, studs, and miniature sets",
    "Toy brick construction world, visible studs, glossy ABS plastic, miniature diorama lighting, hard toy-scale proportions, clean tabletop set.",
    "organic skin, cloth folds, photoreal humans, painterly strokes",
    "Macro tabletop camera. Small push-ins. Keep scale consistent.",
    ["kids", "how-to", "playful recaps"],
    { from: "#c41e3a", to: "#f5d76e", accent: "#1f6feb" },
  ),
  preset(
    "claymation",
    "Claymation",
    "animation3d",
    "Fingerprint clay and miniature warmth",
    "Claymation stop-motion, visible fingerprints in clay, imperfect organic forms, rounded edges, miniature set, warm studio lighting, shallow macro depth of field.",
    "2d, flat digital, smooth plastic, photorealistic human, anime",
    "Slightly stepped motion. Macro, tilt-shift feel. Hold on tactile close-ups.",
    ["whimsical stories", "food", "handmade brands"],
    { from: "#d9a066", to: "#6b3a2a", accent: "#f2c14e" },
  ),
  preset(
    "felt-craft",
    "Felt Craft",
    "animation3d",
    "Stitched wool and cozy handmade sets",
    "Felt and fabric stop-motion, stitched seams, wool texture, cozy handmade miniature set, soft top light, visible needlework, textile characters.",
    "glossy plastic, photoreal, hard metal, digital smoothness",
    "Gentle locked shots. Let texture carry the frame.",
    ["kids", "holidays", "craft brands"],
    { from: "#e7c7b0", to: "#7a4e3a", accent: "#c45c48" },
  ),
  preset(
    "papercraft",
    "Papercraft Diorama",
    "animation3d",
    "Layered cut paper and soft shadows",
    "Paper craft diorama, layered cut paper, soft directional shadow, handmade imperfection, matte card stock, shallow paper-set depth.",
    "photoreal, glossy 3D, painterly wash, motion blur",
    "Parallax between paper layers. Slow truck left or right.",
    ["explainers", "travel", "kids"],
    { from: "#f6e7d0", to: "#8bb8c8", accent: "#e07a5f" },
  ),
  preset(
    "ghibli",
    "Painterly Storybook",
    "illustration",
    "Soft watercolor skies and gentle linework",
    "Soft watercolor, pastel sky, gentle linework, hand-painted backgrounds, pastoral light, magical realism, environmental wonder.",
    "photoreal, 3D render, harsh contrast, neon, gritty",
    "Slow pans across painted environments. Let weather and wind move.",
    ["nature", "gentle stories", "travel"],
    { from: "#b7d7c2", to: "#7aa2c4", accent: "#f3c98b" },
  ),
  preset(
    "retro-cartoon",
    "Retro Cartoon",
    "illustration",
    "Ink outlines and mid-century color",
    "Retro cartoon, bold ink outlines, cel shading, mid-century color cards, rubber-hose energy, simple backgrounds, limited palette.",
    "photoreal, 3D, watercolor wash, noisy grain",
    "Snap cuts. Hold a pose. Slight smear on big moves.",
    ["comedy", "ads", "kids"],
    { from: "#f4e1b4", to: "#c23b22", accent: "#2b6cb0" },
  ),
  preset(
    "pixel-art",
    "Pixel Art",
    "illustration",
    "Crisp pixels and dithered light",
    "Pixel art, 16-bit, crisp pixels, ordered dithering, limited palette, chunky sprites, no anti-aliasing, retro game lighting.",
    "smooth gradients, photoreal, vector curves, film grain",
    "Integer-scale camera. Short holds. Tile the world.",
    ["gaming", "nostalgia", "tech"],
    { from: "#2d1b4e", to: "#4ecdc4", accent: "#ffe66d" },
  ),
  preset(
    "paper-collage",
    "Paper Collage",
    "illustration",
    "Cut-outs, torn edges, mixed print",
    "Paper collage, torn magazine edges, mixed print textures, overlapping cut-outs, analog glue shadows, graphic composition.",
    "seamless 3D, photoreal continuity, smooth gradients",
    "Hard cuts between collage layers. Occasional scale pops.",
    ["essays", "culture", "ads"],
    { from: "#f2e6d8", to: "#3d405b", accent: "#e07a5f" },
  ),
  preset(
    "kids",
    "Kids",
    "illustration",
    "Bright, friendly, easy-to-read shapes",
    "Bright friendly illustration for children, simple readable shapes, high-contrast colors, round characters, clean backgrounds, cheerful lighting.",
    "horror, gore, photoreal, dense detail, muted palette",
    "Eye-level, centered subjects. Fast but clear cuts.",
    ["education", "kids products", "songs"],
    { from: "#ffe566", to: "#7ad7f0", accent: "#ff6b6b" },
  ),
  preset(
    "creative",
    "Creative",
    "illustration",
    "Abstract shapes and graphic motion",
    "Abstract graphic motion, bold shapes, unexpected color pairings, editorial illustration energy, clean negative space, designed type-safe frames.",
    "literal photoreal, cluttered props, muddy brown",
    "Graphic wipes and shape morphs. Keep one idea per frame.",
    ["brand", "music", "ideas"],
    { from: "#111827", to: "#f472b6", accent: "#22d3ee" },
  ),
  preset(
    "default",
    "Default",
    "realism",
    "Clean, natural, unfussy footage",
    "Clean natural photography, balanced daylight, realistic skin, simple composition, calm modern palette, low noise, no heavy stylization.",
    "extreme stylization, neon, heavy grain, fisheye, horror",
    "Eye-level, 50mm feel, gentle push. One subject.",
    ["talking points", "product", "everyday stories"],
    { from: "#d7dde6", to: "#8a93a3", accent: "#f5f5f5" },
  ),
  preset(
    "ultra-realism",
    "Ultra Realism",
    "realism",
    "Believable light and fine surface detail",
    "Photoreal live-action, accurate materials, natural skin texture, physically based lighting, shallow depth of field, documentary truthfulness.",
    "cartoon, clay, plastic skin, oversharpened, CGI sheen",
    "Handheld or locked documentary. Let real motion play out.",
    ["interviews", "products", "places"],
    { from: "#1f2933", to: "#9aa5b1", accent: "#e8e6e1" },
  ),
  preset(
    "realist",
    "Realist",
    "realism",
    "Everyday light, unvarnished rooms",
    "Observational realism, available light, unvarnished interiors, ordinary clothing, muted palette, quiet documentary framing.",
    "glamour lighting, CGI gloss, neon, fantasy wardrobe",
    "Locked-off or observational handheld. Hold longer than you think.",
    ["slice of life", "news", "essays"],
    { from: "#c4b8a8", to: "#5c5346", accent: "#e8dfd2" },
  ),
  preset(
    "photography",
    "Photography",
    "realism",
    "Editorial stills that start to move",
    "Editorial photography, considered composition, studio or golden-hour key, rich but controlled color, magazine-cover framing, subtle motion.",
    "snapshot phone look, messy backgrounds, cartoon, heavy LUT",
    "Slow Ken Burns or a short dolly. Treat each shot as a still first.",
    ["fashion", "food", "portraits"],
    { from: "#111111", to: "#d4d4d4", accent: "#ffffff" },
  ),
  preset(
    "movie",
    "Movie",
    "realism",
    "Anamorphic drama and motivated light",
    "Live-action cinema, anamorphic lens, shallow depth of field, motivated practical lights, warm key and cool fill, filmic contrast, present-tense action.",
    "flat lighting, vertical phone look, cartoon, neon vaporwave",
    "Dolly in, truck, or locked-off coverage. One beat per shot.",
    ["stories", "trailers", "drama"],
    { from: "#1a1410", to: "#c9a227", accent: "#f3e5ab" },
  ),
  preset(
    "modern-noir",
    "Modern Noir",
    "realism",
    "Hard light, wet streets, deep blacks",
    "Modern noir, hard key, deep blacks, wet asphalt reflections, cool rim light, sparse practicals, high-contrast silhouette.",
    "pastel, daylight cheerful, cartoon, overexposed whites",
    "Low angle, Dutch tilt sparingly, slow push into a face.",
    ["mystery", "ads", "night cities"],
    { from: "#0b0d12", to: "#3d4f66", accent: "#c9a66b" },
  ),
  preset(
    "raytraced",
    "Raytraced",
    "realism",
    "Glass, metal, and accurate bounce light",
    "Raytraced 3D, accurate reflections, glass and metal, global illumination, crisp contact shadows, studio product lighting.",
    "painterly, clay, pixel, dirty documentary",
    "Slow orbit around the hero object. Keep the set sparse.",
    ["products", "cars", "architecture"],
    { from: "#0e1116", to: "#89b4e8", accent: "#ffffff" },
  ),
  preset(
    "3d-render",
    "3D Render",
    "realism",
    "Clean CGI with studio control",
    "Clean CGI 3D render, studio backdrop, controlled HDRI, sharp materials, product-ready composition, no film grain.",
    "hand-drawn, stop-motion fingerprints, heavy grain, analog dirt",
    "Turntable or locked hero shot. Reveal one feature at a time.",
    ["products", "architecture", "tech"],
    { from: "#eceff3", to: "#8b95a7", accent: "#111827" },
  ),
  preset(
    "sci-fi",
    "Sci-Fi",
    "worlds",
    "Cool interiors and speculative hardware",
    "Speculative science fiction, cool 6000K interiors, clean hardware, volumetric haze, interface glow, vast scale against human figures.",
    "fantasy forests, rustic wood, vintage film, pastoral",
    "Wide establishing, then a slow push to a detail. Horizon lines stay level.",
    ["tech", "future", "worldbuilding"],
    { from: "#06141f", to: "#1b6ca8", accent: "#7ef9ff" },
  ),
  preset(
    "fantasy",
    "Fantasy",
    "worlds",
    "Mythic light and tactile magic",
    "Mythic fantasy, tactile costumes, moss and stone, warm torch and cool moonlight, visible practical magic, painterly atmosphere.",
    "office interiors, smartphones, neon cyber, documentary grit",
    "Crane up from a detail to a landscape. Let weather move.",
    ["stories", "games", "trailers"],
    { from: "#2a1c14", to: "#6b8f71", accent: "#e8c547" },
  ),
  preset(
    "environment",
    "Environment",
    "worlds",
    "Places first, people small",
    "Landscape-first cinematography, vast environment, small human scale, natural weather, golden or storm light, deep focus where possible.",
    "studio backdrop, talking-head close-up, cluttered interiors",
    "Slow drone or locked wide. Hold the weather.",
    ["travel", "nature", "mood"],
    { from: "#1d3b2a", to: "#8ec5c0", accent: "#f4e1b4" },
  ),
  preset(
    "minecraft",
    "Block World",
    "worlds",
    "Voxel cubes and chunky landscapes",
    "Voxel block world, cubic terrain, chunky characters, daylight biome lighting, simple cubic props, no smooth organic forms.",
    "photoreal, clay fingerprints, watercolor, smooth subdivision",
    "Third-person follow or locked isometric. Snappy turns.",
    ["gaming", "kids", "how-to"],
    { from: "#5d9b4c", to: "#7ec8e3", accent: "#c68642" },
  ),
  preset(
    "nintendo",
    "Playful Adventure",
    "worlds",
    "Bright worlds and toy-like heroes",
    "Playful adventure world, rounded toy-like characters, saturated primary colors, cheerful daylight, simple readable props, joyful motion.",
    "gritty, horror, photoreal, muted office",
    "Bouncy camera. Wide then close on the toy hero.",
    ["kids", "games", "music"],
    { from: "#e63946", to: "#48cae4", accent: "#ffd166" },
  ),
  preset(
    "gta",
    "Sun-Bleached City",
    "worlds",
    "Saturated streets and golden hour cars",
    "Sun-bleached open-world city, saturated late-day light, reflective cars, palm or highway scale, slightly heightened realism, street-level energy.",
    "pastoral, watercolor, cute toys, snowy fantasy",
    "Tracking shots along a street. Low hood-mount energy.",
    ["cars", "cities", "music"],
    { from: "#f4a261", to: "#1d3557", accent: "#e9c46a" },
  ),
  preset(
    "educational",
    "Educational",
    "educational",
    "Clear diagrams and calm coverage",
    "Educational explainer look, clear subjects, calm even lighting, readable props, modest motion, diagrams welcome when they help, uncluttered frames.",
    "horror, heavy stylization, chaotic montage, illegible text",
    "Locked or slow push. Cut every 2–3 seconds to a new idea.",
    ["lessons", "how-to", "science"],
    { from: "#edf2ff", to: "#3b6fd6", accent: "#f5b942" },
  ),
  preset(
    "bold",
    "Bold",
    "motion",
    "Big type, amber on navy",
    "Bold motion-graphics: large type, navy field, amber accent, high contrast, one idea per card.",
    "pastel wash, tiny type, busy collage",
    "Hard cuts between cards. Count-up numbers. Word-by-word captions.",
    ["data stories", "hooks", "explainers"],
    { from: "#0C1222", to: "#1a2744", accent: "#F5B942" },
    "motion",
  ),
  preset(
    "minimal",
    "Minimal",
    "motion",
    "Light, quiet, lots of air",
    "Minimal motion-graphics: light field, quiet type, lots of negative space, thin rules, restrained motion.",
    "heavy drop shadows, neon, dense charts",
    "Slow fades. Leave air around every number.",
    ["essays", "calm explainers"],
    { from: "#F4F5F7", to: "#E4E6EC", accent: "#16181D" },
    "motion",
  ),
  preset(
    "editorial",
    "Editorial",
    "motion",
    "Serif, cream, magazine feel",
    "Editorial motion-graphics: cream paper, serif headlines, magazine pull-quotes, restrained crimson accent.",
    "tech neon, chunky sans-only, loud gradients",
    "Hold on a quote. Slow ken-burns on cream cards.",
    ["quotes", "essays", "newsletters"],
    { from: "#F4EFE6", to: "#e4d6c4", accent: "#A33B32" },
    "motion",
  ),
];

const byId = new Map<string, GenerationPreset>(
  [AUTO_PRESET, ...GENERATION_PRESETS].map((entry) => [entry.id, entry]),
);

export const PRESET_IDS = [AUTO_PRESET_ID, ...GENERATION_PRESETS.map((entry) => entry.id)] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const isPresetId = (value: string): value is PresetId => byId.has(value);

/** Poster files in public/presets are named from the visible label, not the stored id. */
export const presetPosterFile = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}.png` : null;
};

export const presetPosterSrc = (preset: Pick<GenerationPreset, "id" | "name">) => {
  if (!isPresetId(preset.id)) return null;
  const file = presetPosterFile(preset.name);
  return file ? `/presets/${file}` : null;
};

export const presetById = (id: string | null | undefined): GenerationPreset | null => {
  if (!id) return null;
  return byId.get(id) ?? null;
};

export const listPresetsFor = (engine: "footage" | "motion" | "both" = "both") => {
  const catalog = [AUTO_PRESET, ...GENERATION_PRESETS];
  if (engine === "both") return catalog;
  return catalog.filter((entry) => entry.appliesTo === "both" || entry.appliesTo === engine);
};

export const footagePresetIds = () =>
  listPresetsFor("footage")
    .filter((entry) => entry.id !== AUTO_PRESET_ID)
    .map((entry) => entry.id);

export const defaultPresetIdFor = (engine: "footage" | "motion") =>
  engine === "motion" ? DEFAULT_MOTION_PRESET_ID : DEFAULT_FOOTAGE_PRESET_ID;

const DIRECTION_MARKER = "Visual direction for every scene:";

const appendBlock = (prompt: string, block: string) => {
  const trimmed = prompt.trim();
  const piece = block.trim();
  if (!piece) return trimmed;
  if (trimmed.includes(piece)) return trimmed;
  return trimmed ? `${trimmed}\n\n${piece}` : piece;
};

/** Appends a preset's style block and optional global direction. Safe to call twice. */
export const withVisualStyle = (
  prompt: string,
  preset: GenerationPreset | null | undefined,
  visualDirection?: string | null,
) => {
  let next = prompt.trim();
  if (preset && preset.id !== AUTO_PRESET_ID && preset.promptFragment) {
    next = appendBlock(next, preset.promptFragment);
    if (preset.negativeFragment) next = appendBlock(next, `Avoid: ${preset.negativeFragment}`);
  }
  const direction = visualDirection?.trim().slice(0, MAX_VISUAL_DIRECTION) ?? "";
  if (direction) next = appendBlock(next, `${DIRECTION_MARKER} ${direction}`);
  return next;
};

export const styleLockFor = (preset: GenerationPreset | null | undefined, visualDirection?: string | null) =>
  withVisualStyle("", preset, visualDirection);

export const summarizePreset = (preset: GenerationPreset) => ({
  id: preset.id,
  name: preset.name,
  family: preset.family,
  tagline: preset.tagline,
  bestFor: preset.bestFor,
  appliesTo: preset.appliesTo,
  motionNotes: preset.motionNotes,
});
