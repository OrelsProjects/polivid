import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { getBalance } from "@/lib/billing/credits";
import { videoJobCredits } from "@/lib/billing/estimate";
import { estimateProductionCredits } from "@/lib/billing/production";
import { listCharacters } from "@/lib/characters/store";
import { listSongDrafts } from "@/lib/music/song-draft";
import { readHints } from "@/lib/production/hints";
import { loadStructure } from "@/lib/production/jobs/coordinator";
import { audioView, shotView } from "@/lib/production/plan-edits";
import type { DevelopOutput, InputRecord } from "@/lib/production/schema";
import { currentEntityData, getProductionForUser, listProductionsForUser } from "@/lib/production/store";
import { listUploads } from "@/lib/storage/s3";
import { isAudioKey, isImageKey, isVideoKey } from "@/lib/storage/upload-key";
import { listCustomPresets } from "@/lib/video/custom-presets";
import { getVideoJobForUser, listActiveVideoJobs } from "@/lib/video/jobs";
import { stepLabel } from "@/lib/video/job-stages";
import { listPresetsFor, summarizePreset } from "@/lib/video/presets";
import { suggestPreset } from "@/lib/video/suggest-preset";
import { getVideoForUser, listVideosForUser } from "@/lib/videos";
import { priceToolCall } from "@/lib/tools/lookup-credits";
import { TOOL_DEFS, toolByName } from "@/lib/tools/registry";
import { creditsForToolCall } from "@/lib/tools/tool-credits";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, text } from "./support";

const kindFor = (key: string) => (isImageKey(key) ? "image" : isAudioKey(key) ? "audio" : isVideoKey(key) ? "video" : "file");

export const listCharactersHandler: ToolHandler = async (_input, ctx) => {
  const saved = await listCharacters(ctx.userId);
  return {
    characters: [
      { id: "off", name: "No added voice", hasImage: false, hasVoice: false },
      { id: "studio", name: "Studio narrator", hasImage: false, hasVoice: true },
      ...saved.map((character) => ({
        id: character.id,
        name: character.name,
        hasImage: character.hasImage,
        hasVoice: character.hasVoice,
        description: character.description,
        pictures: character.media.filter((item) => item.kind === "image").length,
        clips: character.media.filter((item) => item.kind === "video").length,
        looks: character.looks.map((look) => ({ id: look.id, name: look.name })),
      })),
    ],
  };
};

export const listPresetsHandler: ToolHandler = async (input, ctx) => {
  const engine = asRecord(input).engine;
  const custom = await listCustomPresets(ctx.userId);
  return {
    catalog: listPresetsFor(engine === "motion" || engine === "both" ? engine : "footage").map(summarizePreset),
    custom: custom.map((preset) => ({ id: preset.id, name: preset.name, tagline: preset.tagline })),
  };
};

export const suggestPresetHandler: ToolHandler = async (input) => {
  const row = asRecord(input);
  const engine = row.engine === "motion" ? "motion" : "footage";
  const result = await suggestPreset(text(row.brief), engine);
  return { preset: summarizePreset(result.preset), reason: result.reason };
};

export const listMyVideosHandler: ToolHandler = async (_input, ctx) => {
  const [videos, jobs] = await Promise.all([listVideosForUser(ctx.userId), listActiveVideoJobs(ctx.userId)]);
  return {
    videos: videos.slice(0, 12).map((video) => ({
      id: video.id,
      title: video.title,
      status: video.status,
      format: video.format,
      length: video.length,
      createdAt: video.createdAt,
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      progressPct: job.progressPct,
      prompt: job.prompt,
    })),
  };
};

/**
 * A video by id: a finished library video, or a job that is still being made.
 * Jobs report live progress so an agent (or the PoliVid card in the chat) can follow them.
 */
export const getVideoHandler: ToolHandler = async (input, ctx) => {
  const id = text(asRecord(input).videoId);
  const job = await getVideoJobForUser(ctx.userId, id).catch(() => null);
  if (job) {
    const ready = job.status === "succeeded";
    return {
      id: job.id,
      status: job.status,
      ready,
      step: job.currentStep,
      stepLabel: job.currentStep ? stepLabel(job.currentStep, job.mode) : null,
      progressPct: ready ? 100 : job.progressPct,
      clipIndex: job.clipIndex,
      clipTotal: job.clipTotal,
      clipsDone: job.clipsDone,
      needsModel: job.needsModel,
      prompt: job.prompt,
      format: job.format,
      length: job.length,
      mode: job.mode,
      model: job.model,
      error: job.error,
      next: ready
        ? "The video is ready. open_in_editor edits it."
        : job.needsModel
          ? "The model refused. Call continue_video_with_model with another model from list_models."
          : job.status === "failed"
            ? "It failed. retry_video continues from the last saved clip."
            : "Still working. Check again in a little while.",
    };
  }
  const video = await getVideoForUser(ctx.userId, id);
  if (!video) return { error: "Video not found." };
  return {
    id: video.id,
    title: video.title,
    prompt: video.prompt,
    status: video.status,
    ready: video.status === "ready",
    format: video.format,
    length: video.length,
    error: video.error,
  };
};

export const listMyProductionsHandler: ToolHandler = async (_input, ctx) => listProductionsForUser(ctx.userId);

export const getProductionHandler: ToolHandler = async (input, ctx) => {
  const production = await getProductionForUser(ctx.userId, text(asRecord(input).productionId));
  if (!production) return { error: "Production not found." };
  const [structure, script, inputRecord] = await Promise.all([
    loadStructure(production.id),
    currentEntityData<DevelopOutput["script"]>(production.id, "script", "script"),
    currentEntityData<InputRecord>(production.id, "input", "input"),
  ]);
  const questions = production.entities.find((entity) => entity.kind === "questions")?.current?.data as
    | { questions?: { id: string; question?: string; answer?: string | null }[] }
    | undefined;
  return {
    id: production.id,
    title: production.title,
    status: production.status,
    stage: production.stage,
    mode: production.mode,
    format: production.format,
    targetDurationSec: production.targetDurationSec,
    presetId: production.presetId,
    error: production.error,
    editProjectId: production.editProjectId,
    budgetUsd: production.budgetUsd,
    spentUsd: production.spentUsd,
    estimatedCredits: production.status === "preview" ? await estimateProductionCredits(production.id) : undefined,
    hints: readHints(inputRecord?.hints),
    openQuestions: (questions?.questions ?? []).filter((question) => !question.answer),
    scenes: (script?.scenes ?? []).map((scene) => ({
      id: scene.id,
      order: scene.order,
      heading: scene.heading,
      action: scene.action,
      dialogue: scene.dialogue,
      estimatedSec: scene.estimatedSec,
    })),
    characters: (structure?.characters ?? []).map((character) => ({ id: character.id, name: character.name, voiceId: character.voice.voiceId })),
    locations: (structure?.locations ?? []).map((location) => ({ id: location.id, name: location.name })),
    shots: [...(structure?.shots ?? [])].sort((a, b) => a.order - b.order).map(shotView),
    audio: (structure?.audioSegments ?? []).map(audioView),
    steps: production.steps.map((step) => ({ id: step.id, kind: step.kind, target: step.targetKey, status: step.status, attempt: step.attempt, error: step.error })),
    versions: production.entities
      .filter((entity) => entity.current)
      .map((entity) => ({ kind: entity.kind, key: entity.stableKey, versionId: entity.current!.id, version: entity.current!.version, origin: entity.current!.origin })),
  };
};

export const listUploadsHandler: ToolHandler = async (_input, ctx) => {
  const uploads = await listUploads(ctx.userId);
  return {
    uploads: uploads.slice(0, 24).map((upload) => ({
      key: upload.key,
      kind: kindFor(upload.key),
      uploadedAt: upload.uploadedAt?.toISOString() ?? null,
    })),
  };
};

export const listSongsHandler: ToolHandler = async (_input, ctx) => {
  const drafts = await listSongDrafts(ctx.userId);
  return {
    songs: drafts.slice(0, 12).map((draft) => ({
      id: draft.id,
      seconds: draft.seconds,
      voiceName: draft.voiceName,
      createdAt: draft.createdAt,
      prompt: draft.prompt.slice(0, 160),
    })),
  };
};

export const getCreditBalanceHandler: ToolHandler = async (_input, ctx) => {
  const balance = await getBalance(ctx.userId);
  return { total: balance.total, plan: balance.plan, planCredits: balance.planCredits, bonusCredits: balance.bonusCredits };
};

export const estimateCreditsHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const productionId = text(row.productionId);
  if (productionId) {
    const production = await getProductionForUser(ctx.userId, productionId);
    if (!production) return { error: "Production not found." };
    return { credits: await estimateProductionCredits(production.id) };
  }
  const toolName = text(row.tool);
  if (toolName) {
    const definition = toolByName(toolName);
    if (!definition) return { error: `Unknown tool ${toolName}.` };
    if (!definition.effects.spendsCredits) return { credits: 0, note: `${toolName} does not spend credits.` };
    const credits = await priceToolCall(ctx.userId, toolName, asRecord(row.arguments));
    return credits === null ? { error: `Can't price ${toolName} from those arguments. Include length, or the id it needs.` } : { credits };
  }
  if (typeof row.length !== "number") return { error: "Pass a length, a tool with its arguments, or a productionId." };
  const mode = typeof row.mode === "string" ? row.mode : "prompt";
  const makeTool = TOOL_DEFS.find((definition) => definition.videoMode === mode && (definition.status ?? "live") === "live");
  const credits = makeTool ? creditsForToolCall(makeTool.name, row, { demo: !hasOpenRouterKey() }) : null;
  if (credits !== null) return { credits };
  return {
    credits: videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode,
      tier: typeof row.tier === "string" ? row.tier : undefined,
      length: row.length,
    }),
  };
};
