import "server-only";
import { listCharacters } from "@/lib/characters/store";
import { hasElevenLabsKey, listVoices } from "@/lib/production/adapters/elevenlabs";
import { TOOL_DEFS } from "@/lib/tools/registry";
import type { ToolHandler } from "@/lib/tools/types";
import { isGenerationModelAvailable } from "@/lib/video/available-models";
import { BACKGROUND_LOOPS } from "@/lib/video/backgrounds";
import { EDIT_CHOICES, EDIT_CREDITS, EDIT_OPS } from "@/lib/video/edit-ops";
import { creditRateLabel, GENERATION_MODELS, generationModelById, type GenerationModel } from "@/lib/video/models";
import { describeModeTier, VIDEO_MODES, VIDEO_TIERS, videoModeById } from "@/lib/video/modes";
import { MAX_LYRICS_REFERENCES, MAX_PROMPT_LENGTH, MAX_REFERENCE_IMAGES, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH, VIDEO_FORMATS } from "@/lib/video/schema";
import { ATTACHMENT_ROLES } from "@/lib/video/shot-plan";
import { MAX_FILMED_LENGTH, MAX_LOOP_LENGTH, STILL_MOTIONS, VISUAL_MEDIA } from "@/lib/video/stills";
import { liveTools, toolMatches } from "@/lib/video/tool-catalog";
import { asRecord, text } from "./support";

const makeToolFor = (modeId: string) =>
  TOOL_DEFS.find((definition) => definition.videoMode === modeId && (definition.status ?? "live") === "live")?.name ?? null;

export const listModesHandler: ToolHandler = async () => ({
  modes: VIDEO_MODES.filter((mode) => mode.status === "live").map((mode) => ({
    id: mode.id,
    title: mode.title,
    description: mode.description,
    tool: makeToolFor(mode.id),
    engine: mode.engine,
    needsUpload: mode.upload === "none" ? null : mode.upload,
    promptOptional: mode.promptOptional === true,
    referencePictures: mode.referenceImages === true,
    media: mode.media ?? ["video"],
    spokenScript: mode.spokenScript === true,
    tiers: mode.tiers
      ? Object.fromEntries(
          VIDEO_TIERS.map((tier) => {
            const mapping = mode.tiers![tier];
            return [
              tier,
              {
                model: mapping.model ?? null,
                modelName: mapping.model ? (generationModelById(mapping.model)?.name ?? mapping.model) : null,
                resolution: mapping.resolution,
                strength: mapping.strength,
                label: describeModeTier(mapping),
              },
            ];
          }),
        )
      : null,
  })),
});

const suitsMode = (model: GenerationModel, modeId: string) => {
  const mode = videoModeById(modeId);
  if (!mode || mode.engine !== "video") return false;
  if (mode.referenceImages && modeId === "lyrics") return model.referenceImages;
  if (mode.upload === "image") return model.inputs.includes("image");
  return true;
};

export const listModelsHandler: ToolHandler = async (input) => {
  const mode = text(asRecord(input).mode);
  const models = GENERATION_MODELS.filter((model) => !mode || suitsMode(model, mode));
  return {
    note: "Pass id as model. A clip can only be one of the listed seconds; longer videos are cut from several clips.",
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      vendor: model.vendor,
      summary: model.summary,
      available: isGenerationModelAvailable(model),
      clipSeconds: model.durations,
      resolutions: model.resolutions,
      aspectRatios: model.aspectRatios,
      nativeAudio: model.audio,
      referencePictures: model.referenceImages,
      inputs: model.inputs,
      refusesRealPeople: model.refusesRealPeople === true,
      price: creditRateLabel(model),
    })),
  };
};

export const listTemplatesHandler: ToolHandler = async (input) => {
  const row = asRecord(input);
  const query = text(row.query);
  const mode = text(row.mode);
  const templates = liveTools().filter((tool) => (!mode || tool.mode === mode) && toolMatches(tool, query));
  return {
    templates: templates.map((tool) => ({
      slug: tool.slug,
      title: tool.title,
      description: tool.description,
      mode: tool.mode,
      tool: makeToolFor(tool.mode),
      category: tool.category,
      defaults: tool.defaults ?? {},
      presets: tool.presets ?? null,
    })),
  };
};

export const listVoicesHandler: ToolHandler = async (_input, ctx) => {
  const characters = await listCharacters(ctx.userId);
  let library: { id: string; name: string }[] = [];
  let libraryNote = "Set ELEVENLABS_API_KEY to list the speech library.";
  if (hasElevenLabsKey()) {
    try {
      library = await listVoices();
      libraryNote = "Productions accept these as voiceId.";
    } catch (error) {
      libraryNote = error instanceof Error ? error.message : "Couldn't load the speech library.";
    }
  }
  return {
    narrators: [
      { characterId: "studio", name: "Studio narrator", note: "Default voice for narrated modes." },
      { characterId: "off", name: "No added voice", note: "Keeps only the footage sound." },
      ...characters
        .filter((character) => character.hasVoice)
        .map((character) => ({
          characterId: character.id,
          name: character.name,
          note: character.hasImage ? "Saved character with a voice and a picture." : "Saved character with a voice.",
        })),
    ],
    library,
    libraryNote,
  };
};

export const listBackgroundsHandler: ToolHandler = async () => ({
  backgrounds: BACKGROUND_LOOPS.map((loop) => ({ id: loop.id, name: loop.name, loopSeconds: loop.seconds })),
});

export const listOptionsHandler: ToolHandler = async () => ({
  formats: VIDEO_FORMATS,
  length: {
    min: MIN_VIDEO_LENGTH,
    maxFilmed: Math.min(MAX_VIDEO_LENGTH, MAX_FILMED_LENGTH),
    maxStillsOrLoop: MAX_LOOP_LENGTH,
  },
  tiers: VIDEO_TIERS,
  media: VISUAL_MEDIA,
  stillMotions: STILL_MOTIONS,
  quickEdits: EDIT_OPS.map((op) => ({
    op,
    label: EDIT_CHOICES[op].label,
    values: EDIT_CHOICES[op].values.map((choice) => choice.value),
    defaultValue: EDIT_CHOICES[op].defaultValue,
    credits: EDIT_CREDITS,
  })),
  attachmentRoles: ATTACHMENT_ROLES,
  limits: {
    promptCharacters: MAX_PROMPT_LENGTH,
    referencePictures: MAX_REFERENCE_IMAGES,
    lyricsReferencePictures: MAX_LYRICS_REFERENCES,
    clips: 12,
  },
});
