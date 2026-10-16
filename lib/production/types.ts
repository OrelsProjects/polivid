import type { EntityKind, PlannerProvider, ProductionMode, ProductionStage, ProductionStatus, StepKind, StepStatus } from "./schema";

export interface ProductionSummary {
  id: string;
  title: string;
  status: ProductionStatus;
  stage: ProductionStage;
  format: string;
  targetDurationSec: number;
  budgetUsd: number;
  spentUsd: number;
  updatedAt: string;
}

export interface EntityView {
  id: string;
  kind: EntityKind;
  stableKey: string;
  current: { id: string; version: number; status: string; origin: string; data: unknown } | null;
}

export interface StepView {
  id: string;
  kind: StepKind;
  status: StepStatus;
  targetKey: string;
  attempt: number;
  error: string | null;
}

export interface ProductionView {
  id: string;
  title: string;
  status: ProductionStatus;
  stage: ProductionStage;
  mode: ProductionMode;
  creativeDelegation: boolean;
  plannerProvider: PlannerProvider;
  format: string;
  targetDurationSec: number;
  presetId: string | null;
  visualDirection: string | null;
  characterId: string | null;
  budgetUsd: number;
  spentUsd: number;
  error: string | null;
  editProjectId: string | null;
  /** ISO timestamp of when the current live run began; null while the production is idle. */
  runStartedAt: string | null;
  entities: EntityView[];
  steps: StepView[];
  createdAt: string;
  updatedAt: string;
}
