import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { createVideo } from "@/lib/videos";
import { DEMO_FACTS, DEMO_PLAN, DEMO_QUOTES } from "./demo";
import { renderFootage, saveFootage } from "./footage";
import { normalizePlan, type GenerateInput } from "./pipeline";
import type { ScenePlan, VideoRecord } from "./schema";

export type { GenerateInput } from "./pipeline";

/** Progress stages streamed to the Create page, in order. */
export type GenerateStep = "film" | "save";

/**
 * Prompt -> video model -> saved mp4.
 * The record is saved either way so failures show up in the video list.
 * The caller must have authenticated `userId` (see app/api/videos/route.ts).
 */
export async function generateVideo(
  userId: string,
  input: GenerateInput,
  onStep: (step: GenerateStep) => void,
): Promise<VideoRecord> {
  const demo = !hasOpenRouterKey();
  const base = {
    id: crypto.randomUUID(),
    prompt: input.prompt,
    format: input.format,
    length: input.length,
    createdAt: new Date().toISOString(),
    model: input.model,
    demo,
  };

  if (demo) return generateDemo(userId, base, onStep);

  try {
    onStep("film");
    const clip = await renderFootage(input);
    await saveFootage(base.id, clip.bytes);
    const plan = footagePlan(input.prompt, clip.durationSec);

    onStep("save");
    const record: VideoRecord = {
      ...base,
      length: clip.durationSec,
      status: "ready",
      title: plan.title,
      facts: [],
      quotes: [],
      plan,
      searchSources: [],
      unverifiedFactIds: [],
      error: null,
    };
    await createVideo(userId, record);
    return record;
  } catch (error) {
    const record: VideoRecord = {
      ...base,
      status: "failed",
      title: input.prompt.slice(0, 80),
      facts: [],
      quotes: [],
      plan: null,
      searchSources: [],
      unverifiedFactIds: [],
      error: error instanceof Error ? error.message : String(error),
    };
    await createVideo(userId, record);
    return record;
  }
}

/** No OPENROUTER_API_KEY: walk through the steps and save the fictional sample video. */
async function generateDemo(
  userId: string,
  base: Pick<VideoRecord, "id" | "prompt" | "format" | "length" | "createdAt" | "model" | "demo">,
  onStep: (step: GenerateStep) => void,
): Promise<VideoRecord> {
  for (const step of ["film", "save"] as const) {
    onStep(step);
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  const record: VideoRecord = {
    ...base,
    status: "ready",
    title: DEMO_PLAN.title,
    facts: DEMO_FACTS,
    quotes: DEMO_QUOTES,
    plan: normalizePlan(DEMO_PLAN, base.length),
    searchSources: [],
    unverifiedFactIds: [],
    error: null,
  };
  await createVideo(userId, record);
  return record;
}

const footagePlan = (prompt: string, durationSec: number): ScenePlan => {
  const title = titleFromPrompt(prompt);
  return {
    title,
    scenes: [
      {
        type: "footage",
        headline: title,
        narration: prompt.trim(),
        factIds: [],
        quote: null,
        durationSec,
      },
    ],
  };
};

const titleFromPrompt = (prompt: string) => {
  const trimmed = prompt.trim().replace(/[.?!]+$/g, "");
  const short = trimmed.length > 72 ? `${trimmed.slice(0, 72).trim()}…` : trimmed;
  return short.charAt(0).toUpperCase() + short.slice(1);
};
