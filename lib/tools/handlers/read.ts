import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { getBalance } from "@/lib/billing/credits";
import { videoJobCredits } from "@/lib/billing/estimate";
import { estimateProductionCredits } from "@/lib/billing/production";
import { listCharacters } from "@/lib/characters/store";
import { listSongDrafts } from "@/lib/music/song-draft";
import { getProductionForUser, listProductionsForUser } from "@/lib/production/store";
import { listUploads } from "@/lib/storage/s3";
import { isAudioKey, isImageKey, isVideoKey } from "@/lib/storage/upload-key";
import { listCustomPresets } from "@/lib/video/custom-presets";
import { listActiveVideoJobs } from "@/lib/video/jobs";
import { listPresetsFor, summarizePreset } from "@/lib/video/presets";
import { suggestPreset } from "@/lib/video/suggest-preset";
import { getVideoForUser, listMyVideos } from "@/lib/videos";
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
  const [videos, jobs] = await Promise.all([listMyVideos(), listActiveVideoJobs(ctx.userId)]);
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

export const getVideoHandler: ToolHandler = async (input, ctx) => {
  const video = await getVideoForUser(ctx.userId, text(asRecord(input).videoId));
  if (!video) return { error: "Video not found." };
  return {
    id: video.id,
    title: video.title,
    prompt: video.prompt,
    status: video.status,
    format: video.format,
    length: video.length,
    error: video.error,
  };
};

export const listMyProductionsHandler: ToolHandler = async (_input, ctx) => listProductionsForUser(ctx.userId);

export const getProductionHandler: ToolHandler = async (input, ctx) => {
  const production = await getProductionForUser(ctx.userId, text(asRecord(input).productionId));
  if (!production) return { error: "Production not found." };
  return {
    id: production.id,
    title: production.title,
    status: production.status,
    stage: production.stage,
    format: production.format,
    targetDurationSec: production.targetDurationSec,
    presetId: production.presetId,
    error: production.error,
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
  if (typeof row.length !== "number") return { error: "Pass a length, or a productionId." };
  return {
    credits: videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: typeof row.mode === "string" ? row.mode : undefined,
      tier: typeof row.tier === "string" ? row.tier : undefined,
      length: row.length,
    }),
  };
};
