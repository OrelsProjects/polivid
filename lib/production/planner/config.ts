import type { PlannerProvider, PlannerTask } from "../schema";

const CLAUDE_DEFAULTS: Record<PlannerTask, string> = {
  extract: "anthropic/claude-haiku-5.5",
  develop: "anthropic/claude-sonnet-5.5",
  structure: "anthropic/claude-sonnet-5.5",
  escalate: "anthropic/claude-opus-5.5",
  frontier: "anthropic/claude-fable-5.1",
};

const OPENAI_DEFAULTS: Record<PlannerTask, string> = {
  extract: "openai/gpt-6-luna",
  develop: "openai/gpt-6.1-sol",
  structure: "openai/gpt-6.1-sol",
  escalate: "openai/gpt-6-astra",
  frontier: "openai/gpt-6-astra",
};

const TASK_ENV: Record<PlannerTask, string> = {
  extract: "PLANNER_MODEL_EXTRACT",
  develop: "PLANNER_MODEL_DEVELOP",
  structure: "PLANNER_MODEL_STRUCTURE",
  escalate: "PLANNER_MODEL_ESCALATE",
  frontier: "PLANNER_MODEL_FRONTIER",
};

export const plannerProvider = (): PlannerProvider =>
  process.env.PLANNER_PROVIDER === "openai" ? "openai" : "claude";

export const plannerModelFor = (task: PlannerTask, provider = plannerProvider()) => {
  const override = process.env[TASK_ENV[task]]?.trim();
  if (override) return override;
  return provider === "openai" ? OPENAI_DEFAULTS[task] : CLAUDE_DEFAULTS[task];
};

export const PLANNER_PROMPT_VERSION = "2026-10-15.1";

export const isClaudeSlug = (slug: string) => slug.startsWith("anthropic/");
export const isOpenAiSlug = (slug: string) => slug.startsWith("openai/");
