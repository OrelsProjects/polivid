import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  LIVE_PRODUCTION_STATUSES,
  isLiveProductionStatus,
  parseEntityData,
  type Attachment,
  type EntityKind,
  type PlannerProvider,
  type ProductionMode,
  type ProductionStage,
  type ProductionStatus,
  type StepKind,
  type StepStatus,
  type VersionOrigin,
} from "./schema";
import { REVIEW_REJECTED } from "./progress";
import type { EntityView, ProductionSummary, ProductionView, StepView } from "./types";

export type { EntityView, ProductionSummary, ProductionView, StepView } from "./types";

const money = (value: Prisma.Decimal | number | { toNumber: () => number }) =>
  typeof value === "number" ? value : Number(value.toString());

export const listProductionsForUser = async (userId: string): Promise<ProductionSummary[]> => {
  const rows = await db.production.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as ProductionStatus,
    stage: row.stage as ProductionStage,
    format: row.format,
    targetDurationSec: row.targetDurationSec,
    budgetUsd: money(row.budgetUsd),
    spentUsd: money(row.spentUsd),
    updatedAt: row.updatedAt.toISOString(),
  }));
};

export const listMyProductions = async () => listProductionsForUser((await getCurrentUser()).id);

export const createProductionForUser = async (
  userId: string,
  input: {
    text: string;
    format: string;
    durationSec: number;
    mode: ProductionMode;
    creativeDelegation: boolean;
    plannerProvider: PlannerProvider;
    budgetUsd: number;
    attachments?: Attachment[];
    presetId?: string | null;
    visualDirection?: string | null;
    characterId?: string | null;
  },
) => {
  const title = titleFrom(input.text);
  const production = await db.production.create({
    data: {
      userId,
      title,
      status: "drafting",
      stage: "intake",
      runStartedAt: new Date(),
      mode: input.mode,
      creativeDelegation: input.creativeDelegation,
      plannerProvider: input.plannerProvider,
      budgetUsd: input.budgetUsd,
      format: input.format,
      targetDurationSec: input.durationSec,
      presetId: input.presetId ?? null,
      visualDirection: input.visualDirection ?? null,
      characterId: input.characterId ?? null,
    },
  });
  await putEntity(production.id, "input", "input", {
    text: input.text,
    attachments: input.attachments ?? [],
    classification: null,
  }, "user");
  return production.id;
};

export const getProductionForUser = async (userId: string, id: string): Promise<ProductionView | null> => {
  const row = await db.production.findFirst({
    where: { id, userId },
    include: {
      entities: { include: { versions: { orderBy: { version: "desc" }, take: 8 } } },
      steps: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status as ProductionStatus,
    stage: row.stage as ProductionStage,
    mode: row.mode as ProductionMode,
    creativeDelegation: row.creativeDelegation,
    plannerProvider: row.plannerProvider as PlannerProvider,
    format: row.format,
    targetDurationSec: row.targetDurationSec,
    presetId: row.presetId,
    visualDirection: row.visualDirection,
    characterId: row.characterId,
    budgetUsd: money(row.budgetUsd),
    spentUsd: money(row.spentUsd),
    error: row.error,
    editProjectId: row.editProjectId,
    runStartedAt: row.runStartedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    entities: row.entities.map((entity) => {
      const current = entity.versions.find((version) => version.id === entity.currentVersionId) ?? entity.versions[0] ?? null;
      return {
        id: entity.id,
        kind: entity.kind as EntityKind,
        stableKey: entity.stableKey,
        current: current
          ? {
              id: current.id,
              version: current.version,
              status: current.status,
              origin: current.origin,
              data: current.data,
            }
          : null,
      };
    }),
    steps: row.steps.map((step) => ({
      id: step.id,
      kind: step.kind as StepKind,
      status: step.status as StepStatus,
      targetKey: step.targetKey,
      attempt: step.attempt,
      error: step.error,
    })),
  };
};

export const getMyProduction = async (id: string) => getProductionForUser((await getCurrentUser()).id, id);

export const updateProduction = async (
  id: string,
  data: {
    title?: string;
    status?: ProductionStatus;
    stage?: ProductionStage;
    error?: string | null;
    spentUsd?: number;
    editProjectId?: string | null;
    creditsHeld?: number;
  },
) => {
  if (data.status && isLiveProductionStatus(data.status)) {
    // Start the run clock only when entering a live status from an idle one, so
    // transitions between live statuses (generating → reviewing → …) keep counting.
    await db.production.updateMany({
      where: { id, status: { notIn: [...LIVE_PRODUCTION_STATUSES] } },
      data: { runStartedAt: new Date() },
    });
  }
  const stopsRun = data.status !== undefined && !isLiveProductionStatus(data.status);
  await db.production.update({
    where: { id },
    data: {
      ...(data.title ? { title: data.title } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(stopsRun ? { runStartedAt: null } : {}),
      ...(data.stage ? { stage: data.stage } : {}),
      ...(data.error !== undefined ? { error: data.error } : {}),
      ...(data.spentUsd !== undefined ? { spentUsd: data.spentUsd } : {}),
      ...(data.editProjectId !== undefined ? { editProjectId: data.editProjectId } : {}),
      ...(data.creditsHeld !== undefined ? { creditsHeld: data.creditsHeld } : {}),
    },
  });
  if (data.status === "ready" || data.status === "failed" || data.status === "canceled") {
    const { settleProductionCredits } = await import("@/lib/billing/production");
    await settleProductionCredits(id);
  }
};

export const currentEntityData = async <T>(productionId: string, kind: EntityKind, stableKey?: string): Promise<T | null> => {
  const entity = await db.productionEntity.findFirst({
    where: { productionId, kind, ...(stableKey ? { stableKey } : {}) },
    include: { versions: true },
  });
  if (!entity?.currentVersionId) return null;
  const version = entity.versions.find((entry) => entry.id === entity.currentVersionId);
  if (!version) return null;
  return parseEntityData(kind, version.data) as T;
};

export const putEntity = async (
  productionId: string,
  kind: EntityKind,
  stableKey: string,
  data: unknown,
  origin: VersionOrigin,
  createdByStepId?: string,
) => {
  const parsed = parseEntityData(kind, data);
  const entity = await db.productionEntity.upsert({
    where: { productionId_kind_stableKey: { productionId, kind, stableKey } },
    create: { productionId, kind, stableKey },
    update: {},
  });
  const last = await db.entityVersion.findFirst({
    where: { entityId: entity.id },
    orderBy: { version: "desc" },
  });
  if (last) {
    await db.entityVersion.update({ where: { id: last.id }, data: { status: "superseded" } });
  }
  const version = await db.entityVersion.create({
    data: {
      entityId: entity.id,
      version: (last?.version ?? 0) + 1,
      data: parsed as Prisma.InputJsonValue,
      origin,
      createdByStepId: createdByStepId ?? null,
      status: "accepted",
    },
  });
  await db.productionEntity.update({
    where: { id: entity.id },
    data: { currentVersionId: version.id, acceptedVersionId: version.id },
  });
  return version;
};

export const markVersionsStale = async (versionIds: string[]) => {
  if (versionIds.length === 0) return;
  await db.entityVersion.updateMany({
    where: { id: { in: versionIds } },
    data: { status: "stale" },
  });
};

export const enqueueStep = async (input: {
  productionId: string;
  kind: StepKind;
  targetKey: string;
  dependsOn: string[];
  inputHash: string;
  maxAttempts?: number;
}) => {
  const idempotencyKey = `${input.productionId}:${input.kind}:${input.targetKey}:${input.inputHash}`;
  return db.productionStep.upsert({
    where: { idempotencyKey },
    create: {
      productionId: input.productionId,
      kind: input.kind,
      status: input.dependsOn.length ? "pending" : "ready",
      dependsOn: input.dependsOn,
      idempotencyKey,
      inputHash: input.inputHash,
      targetKey: input.targetKey,
      maxAttempts: input.maxAttempts ?? Number(process.env.PRODUCTION_MAX_RETRIES ?? "2"),
    },
    update: {},
  });
};

export const listSteps = async (productionId: string) =>
  db.productionStep.findMany({ where: { productionId }, orderBy: { createdAt: "asc" } });

const LEASABLE = { in: ["ready", "leased", "waiting_provider"] as StepStatus[] };
const unleased = () => [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }];

export const leaseReadySteps = async (workerId: string, limit = 4, leaseMs = 15 * 60_000) => {
  const ready = await db.productionStep.findMany({
    where: { status: LEASABLE, OR: unleased() },
    take: limit * 3,
    orderBy: { createdAt: "asc" },
  });
  const leased = [];
  for (const step of ready) {
    if (leased.length >= limit) break;
    // The lease check is repeated in the write so two overlapping ticks can never both claim a step.
    const result = await db.productionStep.updateMany({
      where: { id: step.id, status: LEASABLE, OR: unleased() },
      data: {
        status: "leased",
        workerId,
        leaseUntil: new Date(Date.now() + leaseMs),
        attempt: step.status === "waiting_provider" ? step.attempt : step.attempt + 1,
      },
    });
    if (result.count === 1) leased.push(step);
  }
  return leased;
};

export const finishStep = async (id: string, status: StepStatus, error?: string | null) => {
  await db.productionStep.update({
    where: { id },
    data: { status, error: error ?? null, leaseUntil: null },
  });
};

export const unblockDependents = async (productionId: string) => {
  const steps = await listSteps(productionId);
  const succeeded = new Set(
    steps.filter((step) => step.status === "succeeded").map((step) => `${step.kind}:${step.targetKey}`),
  );
  for (const step of steps) {
    if (step.status !== "pending") continue;
    if (step.dependsOn.every((dep) => succeeded.has(dep))) {
      await db.productionStep.update({ where: { id: step.id }, data: { status: "ready" } });
    }
  }
};

export const addDependency = async (productionId: string, from: { kind: string; id: string }, to: { kind: string; id: string }) => {
  await db.productionDependency.create({
    data: {
      productionId,
      fromKind: from.kind,
      fromId: from.id,
      toKind: to.kind,
      toId: to.id,
    },
  });
};

export const listDependencies = async (productionId: string) =>
  db.productionDependency.findMany({ where: { productionId } });

export const saveGenerationJob = async (data: {
  productionId: string;
  stepId: string;
  provider: string;
  route: string;
  modelId: string;
  request: unknown;
  status: string;
  providerJobId?: string | null;
  estimatedUsd: number;
}) =>
  db.generationJob.create({
    data: {
      productionId: data.productionId,
      stepId: data.stepId,
      provider: data.provider,
      route: data.route,
      modelId: data.modelId,
      request: data.request as Prisma.InputJsonValue,
      status: data.status,
      providerJobId: data.providerJobId ?? null,
      estimatedUsd: data.estimatedUsd,
    },
  });

export const updateGenerationJob = async (
  id: string,
  data: {
    status?: string;
    providerJobId?: string | null;
    outputs?: unknown;
    usage?: unknown;
    actualUsd?: number;
    interactionContext?: unknown;
    submittedAt?: Date;
    completedAt?: Date;
  },
) => {
  await db.generationJob.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.providerJobId !== undefined ? { providerJobId: data.providerJobId } : {}),
      ...(data.outputs ? { outputs: data.outputs as Prisma.InputJsonValue } : {}),
      ...(data.usage ? { usage: data.usage as Prisma.InputJsonValue } : {}),
      ...(data.actualUsd !== undefined ? { actualUsd: data.actualUsd } : {}),
      ...(data.interactionContext !== undefined ? { interactionContext: data.interactionContext as Prisma.InputJsonValue } : {}),
      ...(data.submittedAt ? { submittedAt: data.submittedAt } : {}),
      ...(data.completedAt ? { completedAt: data.completedAt } : {}),
    },
  });
};

const isSuperseded = (settings: unknown) =>
  Boolean(settings && typeof settings === "object" && (settings as { superseded?: unknown }).superseded);

/** The step's current job. Jobs from a discarded take are superseded and never reused. */
export const latestJobForStep = async (stepId: string) => {
  const jobs = await db.generationJob.findMany({ where: { stepId }, orderBy: { createdAt: "desc" } });
  return jobs.find((job) => !isSuperseded(job.settings)) ?? null;
};

export const addUsage = async (productionId: string, jobId: string | null, provider: string, model: string, usd: number, units: unknown) => {
  await db.usageLedger.create({
    data: {
      productionId,
      jobId,
      provider,
      model,
      usd,
      units: units as Prisma.InputJsonValue,
    },
  });
  const sum = await db.usageLedger.aggregate({ where: { productionId }, _sum: { usd: true } });
  await db.production.update({
    where: { id: productionId },
    data: { spentUsd: sum._sum.usd ?? 0 },
  });
};

export const saveAsset = async (data: {
  productionId: string;
  storageKey: string;
  kind: string;
  mime: string;
  sha256: string;
  probe: unknown;
  producedByJobId?: string;
  inputVersionIds: string[];
  status: string;
}) =>
  db.productionAsset.create({
    data: {
      productionId: data.productionId,
      storageKey: data.storageKey,
      kind: data.kind,
      mime: data.mime,
      sha256: data.sha256,
      probe: data.probe as Prisma.InputJsonValue,
      producedByJobId: data.producedByJobId ?? null,
      inputVersionIds: data.inputVersionIds,
      status: data.status,
    },
  });

export const getAssetForUser = async (userId: string, assetId: string) => {
  const asset = await db.productionAsset.findFirst({
    where: { id: assetId },
    include: { production: { select: { userId: true } } },
  });
  if (!asset || asset.production.userId !== userId) return null;
  return asset;
};

export const listAssets = async (productionId: string) =>
  db.productionAsset.findMany({ where: { productionId }, orderBy: { createdAt: "asc" } });

export const cancelOpenSteps = async (productionId: string) => {
  await db.productionStep.updateMany({
    where: { productionId, status: { in: ["pending", "ready", "leased", "waiting_provider", "blocked"] } },
    data: { status: "canceled" },
  });
};

type StepRow = { id: string; idempotencyKey: string };

const resetStep = (step: StepRow, status: "ready" | "pending") =>
  db.productionStep.update({
    where: { id: step.id },
    data: {
      status,
      error: null,
      leaseUntil: null,
      workerId: null,
      attempt: 0,
      idempotencyKey: `${step.idempotencyKey}:retry${Date.now().toString(36)}`,
    },
  });

/** A rejected review means the take itself is wrong: discard it, film the shot again, then review the new take. */
const regenerateRejectedShot = async (productionId: string, review: StepRow & { targetKey: string }) => {
  const takeSteps = await db.productionStep.findMany({
    where: { productionId, targetKey: review.targetKey, kind: { in: ["shot_video", "lipsync"] } },
  });
  const jobs = await db.generationJob.findMany({
    where: { stepId: { in: [...takeSteps.map((step) => step.id), review.id] } },
  });
  for (const job of jobs) {
    const settings = job.settings && typeof job.settings === "object" && !Array.isArray(job.settings) ? job.settings : {};
    await db.generationJob.update({ where: { id: job.id }, data: { settings: { ...settings, superseded: true } } });
  }
  const producedBy = jobs.flatMap((job) => [job.id, job.providerJobId].filter((id): id is string => Boolean(id)));
  await db.productionAsset.updateMany({
    where: { productionId, kind: "video", status: "accepted", producedByJobId: { in: producedBy } },
    data: { status: "rejected" },
  });
  for (const step of [...takeSteps, review]) await resetStep(step, "pending");
  await unblockDependents(productionId);
};

export const retryStep = async (productionId: string, stepId: string) => {
  const step = await db.productionStep.findFirst({ where: { id: stepId, productionId } });
  if (!step) return false;
  if (
    step.status !== "failed" &&
    step.status !== "canceled" &&
    step.status !== "blocked" &&
    step.status !== "leased"
  ) {
    return false;
  }
  if (step.kind === "review_shot" && step.status === "failed" && step.error === REVIEW_REJECTED) {
    await regenerateRejectedShot(productionId, step);
    return true;
  }
  await db.generationJob.updateMany({
    where: { stepId, status: { in: ["submitting", "needs_reconcile"] } },
    data: { status: "failed" },
  });
  await resetStep(step, "ready");
  return true;
};

const titleFrom = (text: string) => {
  const line = text.trim().split("\n")[0] ?? "Untitled production";
  return line.length > 72 ? `${line.slice(0, 72).trim()}…` : line || "Untitled production";
};
