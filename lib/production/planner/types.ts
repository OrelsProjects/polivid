import type { z } from "zod";
import type { PlannerTask } from "../schema";

export interface PlannerAttachment {
  name: string;
  mime: string;
  text: string;
}

export interface PlannerRequest<T extends z.ZodType> {
  task: PlannerTask;
  schema: T;
  system: string;
  input: string;
  attachments?: PlannerAttachment[];
  repairHint?: string;
}

export interface PlannerUsage {
  inputTokens: number;
  outputTokens: number;
  usd: number;
  latencyMs: number;
}

export interface PlannerResult<T> {
  output: T;
  model: string;
  provider: string;
  usage: PlannerUsage;
  repaired: boolean;
  cached: boolean;
}

export interface Planner {
  run: <T extends z.ZodType>(request: PlannerRequest<T>) => Promise<PlannerResult<z.infer<T>>>;
}
