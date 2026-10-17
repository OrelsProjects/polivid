import "server-only";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { approveGenerationCharged, regenerateGenerationCharged } from "@/lib/billing/production";
import { resumeFromLastStep, startPlanning } from "@/lib/production/jobs/coordinator";
import { startProductionTicker, tickProductionJobs } from "@/lib/production/jobs/runner";
import { restoreProductionVersion } from "@/lib/production/restore";
import { cancelOpenSteps, getProductionForUser, retryStep, updateProduction } from "@/lib/production/store";
import {
  cancelVideoJobForUser,
  requestStopAfterClip,
  resumeFailedVideoJob,
  resumePausedVideoJob,
} from "@/lib/video/jobs";
import { startVideoJob } from "@/lib/video/worker";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, text, toolError } from "./support";

const videoId = (input: unknown) => text(asRecord(input).videoId);
const productionId = (input: unknown) => text(asRecord(input).productionId);

const kickVideo = (userId: string, id: string) => {
  void startVideoJob(userId, id).catch((error) => {
    console.error("Video stopped", error);
  });
};

export const retryVideoHandler: ToolHandler = async (input, ctx) => {
  const id = videoId(input);
  try {
    const outcome = await resumeFailedVideoJob(ctx.userId, id);
    if (outcome.result === "missing") return { error: "Video not found." };
    if (outcome.result === "empty") return { error: "No clips were saved. Start from scratch." };
    if (outcome.result === "finished") return { error: "This video is not failed." };
    kickVideo(ctx.userId, id);
    return { jobId: id, status: "running", clipsReady: outcome.clipsReady, clipTotal: outcome.clipTotal };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return { error: error.message };
    return toolError(error, "Couldn't continue this video.");
  }
};

export const pauseVideoHandler: ToolHandler = async (input, ctx) => {
  const outcome = await requestStopAfterClip(ctx.userId, videoId(input));
  if (outcome.result === "missing") return { error: "Video not found." };
  if (outcome.result === "single") return { error: "This video is one clip." };
  if (outcome.result === "finished") return { error: "This video is not filming." };
  return { status: "stopping" };
};

export const resumeVideoHandler: ToolHandler = async (input, ctx) => {
  const id = videoId(input);
  try {
    const outcome = await resumePausedVideoJob(ctx.userId, id);
    if (outcome.result === "missing") return { error: "Video not found." };
    if (outcome.result === "finished") return { error: "This video is not paused." };
    kickVideo(ctx.userId, id);
    return { jobId: id, status: "running" };
  } catch (error) {
    return toolError(error, "Couldn't continue this video.");
  }
};

export const cancelVideoHandler: ToolHandler = async (input, ctx) => {
  const outcome = await cancelVideoJobForUser(ctx.userId, videoId(input));
  if (outcome.result === "missing") return { error: "Video not found." };
  if (outcome.result === "finished") return { error: "This video is already finished." };
  return { status: "canceled" };
};

const ownedProduction = async (userId: string, id: string) => {
  if (!id) return null;
  return getProductionForUser(userId, id);
};

export const answerProductionQuestionsHandler: ToolHandler = async (input, ctx) => {
  const id = productionId(input);
  const production = await ownedProduction(ctx.userId, id);
  if (!production) return { error: "Production not found." };
  const answers = asRecord(input).answers;
  if (!answers || typeof answers !== "object") return { error: "Add the answers first." };
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string") clean[key] = value;
  }
  const result = await startPlanning(id, ctx.userId, { answers: clean });
  return { productionId: id, status: result.status };
};

export const approveProductionHandler: ToolHandler = async (input, ctx) => {
  const id = productionId(input);
  const production = await ownedProduction(ctx.userId, id);
  if (!production) return { error: "Production not found." };
  if (production.status !== "preview") return { error: "This production is not waiting for approval." };
  try {
    await approveGenerationCharged(id, ctx.userId);
  } catch (error) {
    return toolError(error, "Couldn't approve that production.");
  }
  void tickProductionJobs();
  return { productionId: id, status: "generating" };
};

export const regenerateProductionHandler: ToolHandler = async (input, ctx) => {
  const id = productionId(input);
  const production = await ownedProduction(ctx.userId, id);
  if (!production) return { error: "Production not found." };
  if (production.status !== "ready") return { error: "This production is not ready to regenerate." };
  try {
    const created = await regenerateGenerationCharged(id, ctx.userId);
    void tickProductionJobs();
    return { productionId: created.id, status: "generating" };
  } catch (error) {
    return toolError(error, "Couldn't regenerate this video.");
  }
};

export const retryProductionHandler: ToolHandler = async (input, ctx) => {
  const id = productionId(input);
  const production = await ownedProduction(ctx.userId, id);
  if (!production) return { error: "Production not found." };
  const stepId = text(asRecord(input).stepId);
  try {
    if (stepId) {
      const ok = await retryStep(id, stepId);
      if (!ok) return { error: "That step cannot be retried." };
      await updateProduction(id, { status: "generating", error: null });
      startProductionTicker();
      await tickProductionJobs();
      return { productionId: id, status: "generating" };
    }
    const result = await resumeFromLastStep(id, ctx.userId);
    startProductionTicker();
    await tickProductionJobs();
    return { productionId: id, status: result.status };
  } catch (error) {
    return toolError(error, "Couldn't retry from the last step.");
  }
};

export const cancelProductionHandler: ToolHandler = async (input, ctx) => {
  const id = productionId(input);
  const production = await ownedProduction(ctx.userId, id);
  if (!production) return { error: "Production not found." };
  await cancelOpenSteps(id);
  await updateProduction(id, { status: "canceled", error: "You canceled this production." });
  return { productionId: id, status: "canceled" };
};

export const restoreVersionHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return restoreProductionVersion(ctx.userId, text(row.productionId), text(row.versionId));
};
