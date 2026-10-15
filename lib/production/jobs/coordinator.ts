import { createHash } from "node:crypto";
import { getPlanner, plannerProvider } from "../planner";
import { applyAnswers, needsUserQuestions, runDevelopPass, runStructurePass } from "../plan";
import { resumeTarget } from "./resume";
import { preflight, repairPreflightStructure } from "../capabilities";
import { estimatePlanCost } from "../cost";
import type { AudioSegment, Character, CreativeBrief, DevelopOutput, InputRecord, Location, Shot, StructureOutput } from "../schema";
import {
  currentEntityData,
  enqueueStep,
  listSteps,
  putEntity,
  retryStep,
  updateProduction,
} from "../store";
import { plannedStepsAfterApprove, stepIdentity } from "./graph";
import { labelForPlanningStep, type PlanningProgress, type PlanningStepKey } from "../progress";
import { persistDevelop, persistStructure } from "./persist";
import { cloneProductionSettings } from "./clone";

const hashOf = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);

const preflightOrRepair = async (
  productionId: string,
  develop: DevelopOutput,
  structure: StructureOutput,
  budgetUsd: number,
  plannerUsd: number,
) => {
  const cost = estimatePlanCost({ develop, structure }, { plannerUsd });
  const check = preflight({ develop, structure }, { budgetUsd, estimatedUsd: cost.total });
  if (check.ok) return { ok: true as const, cost };
  const repaired = repairPreflightStructure(structure, check.issues);
  const second = preflight({ develop, structure: repaired }, { budgetUsd, estimatedUsd: cost.total });
  if (!second.ok) {
    return { ok: false as const, message: second.issues.map((issue) => issue.message).join(" ") };
  }
  await persistStructure(productionId, repaired);
  return { ok: true as const, cost };
};

const markPreview = async (productionId: string, userId: string, cost: { total: number }) => {
  const productionMode = (await (await import("@/lib/db")).db.production.findUnique({ where: { id: productionId } }))!;
  await updateProduction(productionId, { status: "preview", stage: "preview", error: null });
  if (productionMode.mode === "auto" && productionMode.creativeDelegation) {
    const { approveGenerationCharged } = await import("@/lib/billing/production");
    const { InsufficientCreditsError } = await import("@/lib/billing/errors");
    try {
      await approveGenerationCharged(productionId, userId);
    } catch (error) {
      if (!(error instanceof InsufficientCreditsError)) throw error;
    }
  }
  return { status: "preview" as const, cost };
};

/** Planning sets the production to `drafting` first, so a thrown planner error must not leave it there. */
const failOnError = async <T>(productionId: string, run: () => Promise<T>) => {
  try {
    return await run();
  } catch (error) {
    await updateProduction(productionId, { status: "failed", error: "Couldn't finish the plan. Try again." }).catch(
      () => undefined,
    );
    throw error;
  }
};

type PlanningOptions = { answers?: Record<string, string>; onProgress?: (event: PlanningProgress) => void };

export const startPlanning = (productionId: string, userId: string, options: PlanningOptions = {}) =>
  failOnError(productionId, () => planFromInput(productionId, userId, options));

const planFromInput = async (productionId: string, userId: string, options: PlanningOptions) => {
  const report = (key: PlanningStepKey, state: "active" | "done" = "active", label?: string) => {
    options.onProgress?.({ key, label: labelForPlanningStep(key, label), state });
  };
  const fail = async (message: string) => {
    await updateProduction(productionId, { status: "failed", error: message });
    return { status: "failed" as const };
  };

  const input = await currentEntityData<InputRecord>(productionId, "input", "input");
  if (!input) throw new Error("This production has no input.");
  const productionMode = (await (await import("@/lib/db")).db.production.findUnique({ where: { id: productionId } }))!;
  report("read");
  await updateProduction(productionId, { status: "drafting", stage: "develop", error: null });
  const planner = getPlanner();
  const existing = await currentEntityData<DevelopOutput["questions"]>(productionId, "questions", "questions");
  report("develop");
  let developResult = await runDevelopPass(planner, {
    text: input.text,
    format: productionMode.format,
    durationSec: productionMode.targetDurationSec,
    language: "en",
    answers: options.answers,
    delegated: productionMode.creativeDelegation,
  });
  if (options.answers) {
    developResult = {
      ...developResult,
      develop: applyAnswers(developResult.develop, options.answers),
    };
  }
  report("check");
  if (!developResult.validation.ok) {
    return fail(developResult.validation.issues.map((issue) => issue.message).join(" "));
  }
  await persistDevelop(productionId, developResult.develop);
  if (needsUserQuestions(developResult.develop, productionMode.creativeDelegation) && !existing?.questions.some((q) => q.answer)) {
    report("ready", "active", "Waiting on a few choices");
    await updateProduction(productionId, { status: "awaiting_answers", stage: "develop" });
    return { status: "awaiting_answers" as const };
  }

  return finishFromDevelop(productionId, userId, developResult.develop, {
    onProgress: options.onProgress,
    plannerUsd: developResult.usage.usd,
  });
};

const finishFromDevelop = async (
  productionId: string,
  userId: string,
  develop: DevelopOutput,
  options: { onProgress?: (event: PlanningProgress) => void; plannerUsd?: number; retryNotes?: string | null } = {},
) => {
  const report = (key: PlanningStepKey, state: "active" | "done" = "active", label?: string) => {
    options.onProgress?.({ key, label: labelForPlanningStep(key, label), state });
  };
  const fail = async (message: string) => {
    await updateProduction(productionId, { status: "failed", error: message });
    return { status: "failed" as const };
  };
  const productionMode = (await (await import("@/lib/db")).db.production.findUnique({ where: { id: productionId } }))!;
  const planner = getPlanner();
  report("structure");
  await updateProduction(productionId, { status: "drafting", stage: "structure", error: null });
  const structured = await runStructurePass(planner, develop, { retryNotes: options.retryNotes });
  if (!structured.validation.ok) {
    return fail(structured.validation.issues.map((issue) => issue.message).join(" "));
  }
  await persistStructure(productionId, structured.structure);
  report("cost");
  const accepted = await preflightOrRepair(
    productionId,
    develop,
    structured.structure,
    Number(productionMode.budgetUsd),
    (options.plannerUsd ?? 0) + structured.usage.usd,
  );
  if (!accepted.ok) return fail(accepted.message);
  report("ready");
  const result = await markPreview(productionId, userId, accepted.cost);
  report("ready", "done");
  return result;
};

export const loadDevelop = async (productionId: string): Promise<DevelopOutput | null> => {
  const script = await currentEntityData<DevelopOutput["script"]>(productionId, "script", "script");
  const brief = await currentEntityData<DevelopOutput["brief"]>(productionId, "brief", "brief");
  const requirements = await currentEntityData<DevelopOutput["requirements"]>(productionId, "requirements", "requirements");
  if (!script || !brief || !requirements) return null;
  const assumptions =
    (await currentEntityData<DevelopOutput["assumptions"]>(productionId, "assumptions", "assumptions")) ?? {
      assumptions: [],
      proposedAdditions: [],
    };
  const questions =
    (await currentEntityData<DevelopOutput["questions"]>(productionId, "questions", "questions")) ?? { questions: [] };
  const input = await currentEntityData<InputRecord>(productionId, "input", "input");
  const targetSec = requirements.durationSec.value;
  return {
    classification: input?.classification ?? "rough_idea",
    requirements,
    assumptions,
    questions,
    brief,
    script,
    durationFit: { estimatedSec: targetSec, targetSec, fits: true, proposal: null },
  };
};

export const resumeFromLastStep = (productionId: string, userId: string) =>
  failOnError(productionId, () => resumeProduction(productionId, userId));

const resumeProduction = async (productionId: string, userId: string) => {
  const steps = await listSteps(productionId);
  const failed = steps.filter(
    (step) => step.status === "failed" || step.status === "canceled" || step.status === "blocked",
  );
  const develop = await loadDevelop(productionId);
  const target = resumeTarget({ failedJobCount: failed.length, hasDevelop: Boolean(develop) });
  if (target === "jobs") {
    for (const step of failed) {
      await retryStep(productionId, step.id);
    }
    await updateProduction(productionId, { status: "generating", error: null });
    return { status: "generating" as const };
  }
  if (target === "structure" && develop) {
    const production = (await (await import("@/lib/db")).db.production.findUnique({ where: { id: productionId } }))!;
    if (needsUserQuestions(develop, production.creativeDelegation) && !develop.questions.questions.some((question) => question.answer)) {
      await updateProduction(productionId, { status: "awaiting_answers", stage: "develop", error: null });
      return { status: "awaiting_answers" as const };
    }
    await updateProduction(productionId, { status: "drafting", stage: "structure", error: null });
    const existing = await loadStructure(productionId);
    if (existing) {
      const accepted = await preflightOrRepair(productionId, develop, existing, Number(production.budgetUsd), 0);
      if (accepted.ok) return markPreview(productionId, userId, accepted.cost);
    }
    return finishFromDevelop(productionId, userId, develop, { retryNotes: production.error });
  }
  return planFromInput(productionId, userId, {});
};

export const approveGeneration = async (productionId: string) => {
  const develop = await currentEntityData<DevelopOutput>(productionId, "script", "script");
  const structure = await loadStructure(productionId);
  if (!develop || !structure) throw new Error("The plan is not ready.");
  const steps = plannedStepsAfterApprove(structure);
  for (const step of steps) {
    await enqueueStep({
      productionId,
      kind: step.kind,
      targetKey: step.targetKey,
      dependsOn: step.dependsOnKeys,
      inputHash: hashOf({ target: step.targetKey, kind: step.kind }),
    });
  }
  await updateProduction(productionId, { status: "generating", stage: "references" });
  return listSteps(productionId);
};

export const cloneProductionPlan = async (sourceId: string, userId: string) => {
  const { db } = await import("@/lib/db");
  const source = await db.production.findFirst({ where: { id: sourceId, userId } });
  if (!source) throw new Error("Not found.");
  const develop = await loadDevelop(sourceId);
  const structure = await loadStructure(sourceId);
  const input = await currentEntityData<InputRecord>(sourceId, "input", "input");
  if (!develop || !structure || !input) throw new Error("The plan is not ready.");
  const clone = await db.production.create({
    data: {
      userId,
      ...cloneProductionSettings({
        title: source.title,
        mode: source.mode,
        creativeDelegation: source.creativeDelegation,
        plannerProvider: source.plannerProvider,
        budgetUsd: Number(source.budgetUsd),
        format: source.format,
        targetDurationSec: source.targetDurationSec,
      }),
    },
  });
  await putEntity(clone.id, "input", "input", input, "user");
  await persistDevelop(clone.id, develop);
  await persistStructure(clone.id, structure);
  return clone.id;
};

export const loadStructure = async (productionId: string): Promise<StructureOutput | null> => {
  const { db } = await import("@/lib/db");
  const entities = await db.productionEntity.findMany({
    where: { productionId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const pick = <T>(kind: string) =>
    entities
      .filter((entity) => entity.kind === kind)
      .map((entity) => entity.versions[0]?.data as T)
      .filter(Boolean);
  const characters = pick<Character>("character");
  const locations = pick<Location>("location");
  const shots = pick<Shot>("shot");
  if (!characters.length || !shots.length) return null;
  return {
    characters,
    locations,
    props: pick("prop"),
    scenes: pick("scene"),
    shots,
    audioSegments: pick<AudioSegment>("audio_segment"),
    voices: pick("voice"),
  };
};

export const loadBrief = async (productionId: string) => currentEntityData<CreativeBrief>(productionId, "brief", "brief");

export const defaultPlannerProvider = () => plannerProvider();

export { stepIdentity };
