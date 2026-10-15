import { generateText, Output } from "ai";
import type { z } from "zod";
import { openrouter } from "@/lib/ai/openrouter";
import type { PlannerTask } from "../schema";
import { plannerCacheKey, readPlannerCache, writePlannerCache } from "./cache";
import { isClaudeSlug, isOpenAiSlug, plannerModelFor, plannerProvider } from "./config";
import type { Planner, PlannerAttachment, PlannerRequest, PlannerResult } from "./types";

const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  "anthropic/claude-haiku-5.5": { input: 1, output: 5 },
  "anthropic/claude-sonnet-5.5": { input: 3, output: 15 },
  "anthropic/claude-opus-5.5": { input: 15, output: 75 },
  "anthropic/claude-fable-5.1": { input: 2, output: 10 },
  "openai/gpt-6-luna": { input: 0.4, output: 1.6 },
  "openai/gpt-6.1-sol": { input: 2, output: 8 },
  "openai/gpt-6-astra": { input: 15, output: 60 },
};

const usdFor = (model: string, inputTokens: number, outputTokens: number) => {
  const price = TOKEN_PRICES[model] ?? { input: 3, output: 15 };
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
};

const wrapAttachments = (attachments: PlannerAttachment[] = []) => {
  if (attachments.length === 0) return "";
  return attachments
    .map(
      (file) =>
        `\n<attachment name="${file.name}" mime="${file.mime}">\n${file.text}\n</attachment>`,
    )
    .join("");
};

/**
 * Keeps OpenRouter on the model vendor's own API. Other hosts (e.g. Google Vertex for Claude)
 * reject our structured-output schemas as "compiled grammar is too large".
 */
const firstPartyRouting = (vendor: string) => ({
  openrouter: { provider: { order: [vendor], allow_fallbacks: false } },
});

const providerOptionsFor = (model: string, task: PlannerTask) => {
  if (isClaudeSlug(model)) {
    const effort = task === "extract" ? "low" : task === "escalate" || task === "frontier" ? "high" : "medium";
    return { anthropic: { effort }, ...firstPartyRouting("anthropic") };
  }
  if (isOpenAiSlug(model)) {
    const reasoningEffort =
      task === "extract" ? "low" : task === "escalate" || task === "frontier" ? "high" : "medium";
    return { openai: { reasoningEffort }, ...firstPartyRouting("openai") };
  }
  return undefined;
};

const callOnce = async <T extends z.ZodType>(
  model: string,
  request: PlannerRequest<T>,
  extra: string,
) => {
  const started = Date.now();
  const providerOptions = providerOptionsFor(model, request.task);
  const result = await generateText({
    model: openrouter().chat(model),
    instructions: request.system,
    prompt: `${request.input}${wrapAttachments(request.attachments)}${extra}`,
    output: Output.object({ schema: request.schema, name: request.task }),
    ...(providerOptions ? { providerOptions } : {}),
  });
  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;
  return {
    output: result.output as z.infer<T>,
    usage: {
      inputTokens,
      outputTokens,
      usd: usdFor(model, inputTokens, outputTokens),
      latencyMs: Date.now() - started,
    },
  };
};

export const createOpenRouterPlanner = (): Planner => ({
  run: async <T extends z.ZodType>(request: PlannerRequest<T>): Promise<PlannerResult<z.infer<T>>> => {
    const provider = plannerProvider();
    const model = plannerModelFor(request.task, provider);
    const key = plannerCacheKey({
      task: request.task,
      model,
      system: request.system,
      input: request.input,
      attachments: wrapAttachments(request.attachments),
      schemaName: request.task,
    });
    const cached = readPlannerCache<z.infer<T>>(key);
    if (cached) return cached;

    try {
      const first = await callOnce(model, request, request.repairHint ? `\n\nRepair: ${request.repairHint}` : "");
      const parsed = request.schema.safeParse(first.output);
      if (parsed.success) {
        const value: PlannerResult<z.infer<T>> = {
          output: parsed.data,
          model,
          provider,
          usage: first.usage,
          repaired: false,
          cached: false,
        };
        writePlannerCache(key, value);
        return value;
      }

      const escalateModel = plannerModelFor("escalate", provider);
      const repaired = await callOnce(
        escalateModel,
        { ...request, task: "escalate" },
        `\n\nThe previous structured output failed validation:\n${parsed.error.message}\nReturn a corrected object that matches the schema.`,
      );
      const second = request.schema.parse(repaired.output);
      const value: PlannerResult<z.infer<T>> = {
        output: second,
        model: escalateModel,
        provider,
        usage: {
          inputTokens: first.usage.inputTokens + repaired.usage.inputTokens,
          outputTokens: first.usage.outputTokens + repaired.usage.outputTokens,
          usd: first.usage.usd + repaired.usage.usd,
          latencyMs: first.usage.latencyMs + repaired.usage.latencyMs,
        },
        repaired: true,
        cached: false,
      };
      writePlannerCache(key, value);
      return value;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "The planner did not return a usable plan.");
    }
  },
});
