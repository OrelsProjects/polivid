import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { estimateProductionCredits } from "@/lib/billing/production";
import { db } from "@/lib/db";
import { getProductionForUser } from "@/lib/production/store";
import { approvalForSpend, creditsForToolCall } from "@/lib/tools/tool-credits";
import { toolByName } from "@/lib/tools/registry";
import { readJobInput } from "@/lib/video/job-status";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asRecord = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

/** Price a retry or a production approval from the saved job. Null asks the person. */
const lookupCredits = async (userId: string, name: string, input: Record<string, unknown>) => {
  if (name === "retry_video") {
    const id = text(input.videoId);
    if (!id) return null;
    const job = await db.videoJob.findFirst({ where: { id, userId }, select: { input: true } });
    if (!job) return null;
    const stored = readJobInput(job.input);
    return videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: stored.mode || undefined,
      tier: stored.tier || undefined,
      modelSlug: stored.model || undefined,
      resolution: stored.resolution || undefined,
      length: stored.length,
      referenceCount: stored.referenceKeys.length,
      songReady: Boolean(stored.songId),
      cuts: stored.cuts,
    });
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
 * The Coach asks before a destructive action, and before a credit spend of 200 or more.
 * A cheaper spend is approved here, so the chat does not show an approval card.
 */
export const coachToolApproval = async (input: {
  userId: string;
  toolName: string;
  toolInput: unknown;
  attachedCharacterId?: string;
}) => {
  const definition = toolByName(input.toolName);
  if (!definition || definition.approval !== "user") return "not-applicable" as const;
  if (definition.effects.destructive) return "user-approval" as const;
  const row = asRecord(input.toolInput);
  let credits = creditsForToolCall(input.toolName, row, {
    demo: !hasOpenRouterKey(),
    attachedCharacterId: input.attachedCharacterId,
  });
  if (credits === null && definition.effects.spendsCredits) {
    try {
      credits = await lookupCredits(input.userId, input.toolName, row);
    } catch (error) {
      console.error("Could not price a Coach tool", error);
      credits = null;
    }
  }
  return approvalForSpend({ asksApproval: true, destructive: false, credits });
};
