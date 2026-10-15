import "server-only";
import { db } from "@/lib/db";
import { stageForStepKind, statusForStepKind } from "../progress";
import { unblockDependents, finishStep, leaseReadySteps, updateProduction } from "../store";
import { executeStep } from "./execute";

const WORKER_ID = `worker_${process.pid}`;

let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;

export const tickProductionJobs = async () => {
  if (ticking) return;
  ticking = true;
  try {
    const leased = await leaseReadySteps(WORKER_ID);
    for (const step of leased) {
      const production = await db.production.findUnique({ where: { id: step.productionId } });
      if (!production) continue;
      await updateProduction(step.productionId, {
        status: statusForStepKind(step.kind),
        stage: stageForStepKind(step.kind),
      });
      try {
        await executeStep(production.userId, step.productionId, step);
        await unblockDependents(step.productionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "This step failed.";
        if (message.includes("interrupted while submitting")) {
          await finishStep(step.id, "blocked", message);
          continue;
        }
        if (step.attempt >= step.maxAttempts) {
          await finishStep(step.id, "failed", message);
          await updateProduction(step.productionId, { status: "failed", error: message });
        } else {
          await finishStep(step.id, "ready", message);
        }
      }
    }
  } finally {
    ticking = false;
  }
};

export const startProductionTicker = () => {
  if (timer) return;
  timer = setInterval(() => {
    void tickProductionJobs();
  }, 2000);
  void tickProductionJobs();
};
