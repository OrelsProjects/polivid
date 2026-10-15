import { createHash } from "node:crypto";
import { PLANNER_PROMPT_VERSION } from "./config";
import type { PlannerResult } from "./types";

const cache = new Map<string, PlannerResult<unknown>>();

export const plannerCacheKey = (parts: {
  task: string;
  model: string;
  system: string;
  input: string;
  attachments: string;
  schemaName: string;
}) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        version: PLANNER_PROMPT_VERSION,
        ...parts,
      }),
    )
    .digest("hex");

export const readPlannerCache = <T>(key: string): PlannerResult<T> | null => {
  const hit = cache.get(key);
  if (!hit) return null;
  return { ...(hit as PlannerResult<T>), cached: true };
};

export const writePlannerCache = <T>(key: string, result: PlannerResult<T>) => {
  cache.set(key, result);
};

export const clearPlannerCache = () => cache.clear();
