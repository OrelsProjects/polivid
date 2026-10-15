import "server-only";
import { db } from "@/lib/db";
import { stageForStepKind, statusForStepKind } from "../progress";
import { unblockDependents, finishStep, leaseReadySteps, retryStep, updateProduction } from "../store";
import { executeStep } from "./execute";

const WORKER_ID = `worker_${process.pid}`;

const ticker = globalThis as unknown as {
  productionTicker?: ReturnType<typeof setInterval>;
  productionTicking?: boolean;
  /** Re-registered on every module load, so a hot-reloaded server never keeps ticking stale code. */
  productionTick?: () => Promise<void>;
};

const runLeasedStep = async (step: Awaited<ReturnType<typeof leaseReadySteps>>[number]) => {
  const production = await db.production.findUnique({ where: { id: step.productionId } });
  if (!production) return;
  await updateProduction(step.productionId, {
    status: statusForStepKind(step.kind),
    stage: stageForStepKind(step.kind),
  });
  try {
    await executeStep(production.userId, step.productionId, step);
    await unblockDependents(step.productionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "This step failed.";
    const current = await db.productionStep.findUnique({
      where: { id: step.id },
      select: { idempotencyKey: true },
    });
    if (current?.idempotencyKey !== step.idempotencyKey) return;
    if (message.includes("interrupted while submitting")) {
      await finishStep(step.id, "blocked", message);
      return;
    }
    if (step.attempt >= step.maxAttempts) {
      await finishStep(step.id, "failed", message);
      await updateProduction(step.productionId, { status: "failed", error: message });
    } else {
      await finishStep(step.id, "ready", message);
    }
  }
};

export const tickProductionJobs = async () => {
  if (ticker.productionTicking) return;
  ticker.productionTicking = true;
  try {
    const interrupted = await db.productionStep.findMany({
      where: {
        OR: [
          { status: "blocked", error: { contains: "interrupted while submitting" } },
          { status: "leased", leaseUntil: { lt: new Date() } },
        ],
      },
      select: { id: true, productionId: true },
      take: 8,
    });
    for (const step of interrupted) {
      await retryStep(step.productionId, step.id);
    }
    const leased = await leaseReadySteps(WORKER_ID);
    ticker.productionTicking = false;
    await Promise.all(leased.map((step) => runLeasedStep(step)));
  } finally {
    ticker.productionTicking = false;
  }
};

ticker.productionTick = tickProductionJobs;

export const startProductionTicker = () => {
  if (ticker.productionTicker) clearInterval(ticker.productionTicker);
  ticker.productionTicking = false;
  ticker.productionTicker = setInterval(() => {
    void ticker.productionTick?.();
  }, 2000);
  void tickProductionJobs();
};
