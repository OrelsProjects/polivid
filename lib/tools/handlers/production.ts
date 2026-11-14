import "server-only";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { startPlanning } from "@/lib/production/jobs/coordinator";
import { tickProductionJobs } from "@/lib/production/jobs/runner";
import { addAudio, PlanEditError, removeAudio, removeShot, setHints, updateAudio, updateShot } from "@/lib/production/plan-edits";
import { RefilmError, refilmShot } from "@/lib/production/refilm";
import { ProductionHintsSchema } from "@/lib/production/hints";
import type { AudioTrack, Shot } from "@/lib/production/schema";
import { getProductionForUser } from "@/lib/production/store";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, text } from "./support";

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const str = (value: unknown) => (typeof value === "string" ? value : undefined);
const nullableStr = (value: unknown) => (value === null ? null : typeof value === "string" ? value : undefined);

const planEdit = async <T>(run: () => Promise<T>) => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PlanEditError) return { error: error.message };
    throw error;
  }
};

export const productionReplanHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const id = text(row.productionId);
  const parsed = ProductionHintsSchema.safeParse(row.hints ?? {});
  if (!parsed.success) return { error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  const production = await getProductionForUser(ctx.userId, id);
  if (!production) return { error: "Production not found." };
  return planEdit(async () => {
    await setHints(ctx.userId, id, parsed.data);
    const result = await startPlanning(id, ctx.userId);
    void tickProductionJobs();
    return {
      productionId: id,
      status: result.status,
      next: "Call get_production to see the new scenes, shots, and sounds, then approve_production when they look right.",
    };
  });
};

export const productionUpdateShotHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return planEdit(() =>
    updateShot(ctx.userId, text(row.productionId), text(row.shotId), {
      action: str(row.action),
      purpose: str(row.purpose),
      framing: str(row.framing),
      cameraMotion: str(row.cameraMotion),
      emotionalArc: str(row.emotionalArc),
      intendedBeginning: str(row.intendedBeginning),
      intendedEnding: str(row.intendedEnding),
      seconds: num(row.seconds),
      speechMode: str(row.speechMode) as Shot["speechMode"] | undefined,
      model: str(row.model),
    }),
  );
};

export const productionRemoveShotHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return planEdit(() => removeShot(ctx.userId, text(row.productionId), text(row.shotId)));
};

const audioPatch = (row: Record<string, unknown>) => ({
  text: nullableStr(row.text),
  prompt: nullableStr(row.prompt),
  voiceId: nullableStr(row.voiceId),
  seconds: num(row.seconds),
  startOffsetSec: num(row.startOffsetSec),
  fadeInSec: num(row.fadeInSec),
  fadeOutSec: num(row.fadeOutSec),
  shotIds: Array.isArray(row.shotIds) ? row.shotIds.filter((id): id is string => typeof id === "string") : undefined,
});

export const productionUpdateAudioHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return planEdit(() => updateAudio(ctx.userId, text(row.productionId), text(row.audioId), audioPatch(row)));
};

export const productionAddAudioHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const patch = audioPatch(row);
  const seconds = num(row.seconds);
  if (!patch.shotIds?.length || seconds == null) return { error: "Pass shotIds and seconds." };
  return planEdit(() =>
    addAudio(ctx.userId, text(row.productionId), {
      ...patch,
      track: text(row.track) as AudioTrack,
      shotIds: patch.shotIds!,
      seconds,
    }),
  );
};

export const productionRemoveAudioHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return planEdit(() => removeAudio(ctx.userId, text(row.productionId), text(row.audioId)));
};

export const productionRefilmShotHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  try {
    const result = await refilmShot(ctx.userId, text(row.productionId), text(row.shotId), text(row.model) || undefined);
    void tickProductionJobs();
    return result;
  } catch (error) {
    if (error instanceof RefilmError || error instanceof InsufficientCreditsError) return { error: error.message };
    throw error;
  }
};
