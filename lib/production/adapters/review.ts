import { generateText, Output } from "ai";
import { z } from "zod";
import { openrouter } from "@/lib/ai/openrouter";
import { ReviewRecordSchema } from "../schema";
import type { AdapterJob, MediaAdapter } from "./types";

const FindingOutput = z.object({
  passed: z.boolean(),
  findings: ReviewRecordSchema.shape.findings,
  observation: z.object({
    completedActions: z.array(z.string()),
    incompleteActions: z.array(z.string()),
    deviations: z.array(z.string()),
    boundaryOut: z.object({
      position: z.string(),
      direction: z.string(),
      speed: z.string(),
      gaze: z.string(),
      camera: z.string(),
      props: z.array(z.string()),
      incompleteAction: z.string().nullable(),
    }),
  }),
});

export const createReviewAdapter = (): MediaAdapter => ({
  id: "review",
  estimate: () => 0.02,
  submit: async (request, idempotencyKey) => {
    const model = request.modelId.includes("argon") ? "google/gemini-4-argon" : "google/gemini-3.8-flash";
    const result = await generateText({
      model: openrouter().chat(model),
      instructions:
        "You review generated video against a shot plan. Scores are advisory. Return findings with timestamps, evidence, severity, and a proposed repair, plus an observation of what actually happened at the outgoing edit point.",
      prompt: request.prompt,
      output: Output.object({ schema: FindingOutput, name: "review" }),
    });
    return {
      providerJobId: idempotencyKey,
      status: "completed",
      outputs: [{ mime: "application/json", json: result.output }],
      usage: { usd: 0.02, units: { tokens: result.usage?.outputTokens ?? 0 } },
    };
  },
  poll: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
  collect: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
});
