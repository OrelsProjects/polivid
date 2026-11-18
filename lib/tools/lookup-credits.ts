import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { estimateProductionCredits } from "@/lib/billing/production";
import { db } from "@/lib/db";
import { refilmCredits } from "@/lib/production/refilm";
import { getProductionForUser } from "@/lib/production/store";
import { toolByName } from "@/lib/tools/registry";
import { creditsForToolCall, type ToolCreditOptions } from "@/lib/tools/tool-credits";
import { readJobInput } from "@/lib/video/job-status";
import { stillPictureCount } from "@/lib/video/script-markup";
import { probeUpload } from "@/lib/video/compose/upload-file";
import { DEFAULT_SWAP_METHOD, isSwapMethod, swapCredits, swapResolutionFor, swapUsedSeconds } from "@/lib/video/swap";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asRecord = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

/** Price a retry or a production approval from the saved job. Null when it can't be priced. */
export const lookupCredits = async (userId: string, name: string, input: Record<string, unknown>) => {
  if (toolByName(name)?.videoMode === "swap") {
    // Billed by the performance video's length, read from the upload itself. Demo jobs are free.
    if (!hasOpenRouterKey()) return 0;
    const key = text(input.mediaKey);
    if (!key) return null;
    const probe = await probeUpload(userId, key);
    if (!probe.hasVideo || !(probe.durationSec > 0)) return null;
    const method = isSwapMethod(input.method) ? input.method : DEFAULT_SWAP_METHOD;
    return swapCredits(swapUsedSeconds(probe.durationSec, method), swapResolutionFor(text(input.tier) || undefined));
  }
  if (name === "retry_video") {
    const id = text(input.videoId);
    if (!id) return null;
    const job = await db.videoJob.findFirst({ where: { id, userId }, select: { input: true } });
    if (!job) return null;
    const stored = readJobInput(job.input);
    return videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: stored.mode || undefined,
      pictures: stillPictureCount(stored),
      tier: stored.tier || undefined,
      modelSlug: stored.model || undefined,
      resolution: stored.resolution || undefined,
      length: stored.length,
      referenceCount: stored.referenceKeys.length,
      songReady: Boolean(stored.songId),
      cuts: stored.cuts,
    });
  }
  if (name === "production_refilm_shot") {
    const id = text(input.productionId);
    const production = id ? await getProductionForUser(userId, id) : null;
    if (!production) return null;
    return refilmCredits(production.id, text(input.shotId), text(input.model) || undefined);
  }
  if (name === "approve_production" || name === "regenerate_production") {
    const id = text(input.productionId);
    if (!id) return null;
    const production = await getProductionForUser(userId, id);
    if (!production) return null;
    return estimateProductionCredits(production.id);
  }
  return null;
};

/**
 * Credits one tool call will hold: priced from the input, or from the saved job when the input can't tell.
 * Null means unknown. Tools that don't spend return 0.
 */
export const priceToolCall = async (
  userId: string,
  toolName: string,
  toolInput: unknown,
  options: Omit<ToolCreditOptions, "demo"> = {},
) => {
  const definition = toolByName(toolName);
  if (!definition?.effects.spendsCredits) return 0;
  const row = asRecord(toolInput);
  const credits = creditsForToolCall(toolName, row, { ...options, demo: !hasOpenRouterKey() });
  if (credits !== null) return credits;
  try {
    return await lookupCredits(userId, toolName, row);
  } catch (error) {
    console.error(`Could not price ${toolName}`, error);
    return null;
  }
};
