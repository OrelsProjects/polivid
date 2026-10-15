import { createMockPlanner } from "./mock-planner";
import { createOpenRouterPlanner } from "./openrouter-planner";
import type { Planner } from "./types";

export type { Planner, PlannerAttachment, PlannerRequest, PlannerResult } from "./types";
export { plannerModelFor, plannerProvider, PLANNER_PROMPT_VERSION } from "./config";
export { createMockPlanner, mockDevelop, mockStructure } from "./mock-planner";
export { clearPlannerCache } from "./cache";

export const productionProviders = () => (process.env.PRODUCTION_PROVIDERS === "live" ? "live" : "mock");

export const getPlanner = (): Planner => {
  if (productionProviders() === "live") return createOpenRouterPlanner();
  return createMockPlanner();
};
