import { generateText, Output } from "ai";
import { z } from "zod";
import { openrouter } from "@/lib/ai/openrouter";
import { PLANNER_INSTRUCTIONS, RESEARCH_INSTRUCTIONS, SCRIPT_INSTRUCTIONS } from "@/lib/ai/prompts";
import { domainOf } from "./format";
import { lintPlan, type LintResult } from "./lint";
import {
  ResearchSchema,
  ScenePlanSchema,
  type Research,
  type Scene,
  type ScenePlan,
  type SearchSource,
  type VideoFormat,
  type VideoLength,
  FPS,
} from "./schema";

/**
 * The model-facing half of generation, with no database or auth, so it can be
 * run from a script (scripts/try-pipeline.ts) as well as from the app.
 * lib/video/generate.ts wraps it with progress events and persistence.
 */

export interface GenerateInput {
  prompt: string;
  format: VideoFormat;
  length: VideoLength;
  /** OpenRouter slug for the script. */
  model: string;
}

const ScriptSceneSchema = z.object({
  type: z.enum(["hook", "text"]),
  headline: z.string().describe("On-screen line, under 8 words"),
  narration: z.string().describe("One or two spoken sentences for the caption"),
  durationSec: z.number().min(2).max(12),
});

const ScriptSchema = z.object({
  title: z.string(),
  scenes: z.array(ScriptSceneSchema).min(2).max(8),
});

/** Writes the scene script from the prompt. No web search. */
export async function writeScript(input: GenerateInput): Promise<ScenePlan> {
  const result = await generateText({
    model: openrouter().chat(input.model),
    instructions: SCRIPT_INSTRUCTIONS,
    prompt: `Video request: ${input.prompt}\n\nFormat: ${input.format}. Target length: ${input.length} seconds.`,
    output: Output.object({ schema: ScriptSchema, name: "script" }),
  });

  return {
    title: result.output.title,
    scenes: result.output.scenes.map((scene) => ({
      ...scene,
      factIds: [],
      quote: null,
    })),
  };
}

/** Step 1: web search for sourced facts and verbatim quotes. */
export async function runResearch(prompt: string, model: string) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await generateText({
    model: openrouter().chat(model, { plugins: [{ id: "web", max_results: 8 }] }),
    instructions: RESEARCH_INSTRUCTIONS,
    prompt: `Today is ${today}.\n\nStory request: ${prompt}`,
    output: Output.object({ schema: ResearchSchema, name: "research" }),
  });

  // URLs the search actually returned; facts citing anything else get flagged.
  const searchSources: SearchSource[] = result.sources.flatMap((s) =>
    s.sourceType === "url" ? [{ url: s.url, title: s.title ?? null }] : [],
  );
  return { research: dedupeFactIds(result.output), searchSources };
}

/**
 * Steps 2-3: ask for a scene plan, run the deterministic checks, and give the
 * model one chance to fix whatever failed. Returns the lint result so callers
 * can refuse a plan that still has errors.
 */
export async function buildScenePlan(
  input: GenerateInput,
  research: Research,
  searchSources: SearchSource[],
): Promise<{ plan: ScenePlan; lint: LintResult }> {
  let plan = normalizePlan(await runPlanner(input, research), input.length);
  let lint = lintPlan(plan, research.facts, research.quotes, searchSources);
  if (lint.errors.length > 0) {
    plan = normalizePlan(await runPlanner(input, research, { plan, errors: lint.errors }), input.length);
    lint = lintPlan(plan, research.facts, research.quotes, searchSources);
  }
  return { plan, lint };
}

async function runPlanner(
  input: GenerateInput,
  research: Research,
  retry?: { plan: ScenePlan; errors: string[] },
) {
  // The planner sees values so it can choose scenes, but writes only {fact_id}s.
  const facts = research.facts.map((f) => ({
    id: f.id,
    label: f.label,
    kind: f.kind,
    value: f.value,
    points: f.points,
    format: f.format,
    asOf: f.asOf,
    source: domainOf(f.sourceUrl),
  }));

  const sections = [
    `Story request: ${input.prompt}`,
    `Format: ${input.format}. Target length: ${input.length} seconds. Keep each scene between 2 and 12 seconds; playback is scaled to the target.`,
    `Facts:\n${JSON.stringify(facts, null, 2)}`,
    `Quotes:\n${JSON.stringify(research.quotes, null, 2)}`,
  ];
  if (retry) {
    sections.push(
      `Your previous plan failed these checks. Fix every one and return the full corrected plan:\n- ${retry.errors.join("\n- ")}`,
      `Previous plan:\n${JSON.stringify(retry.plan, null, 2)}`,
    );
  }

  const result = await generateText({
    model: openrouter().chat(input.model),
    instructions: PLANNER_INSTRUCTIONS,
    prompt: sections.join("\n\n"),
    output: Output.object({ schema: ScenePlanSchema, name: "scene_plan" }),
  });
  return result.output;
}

/** Scales durations to the target length. Keeps a sources scene only when the plan already has one. */
export function normalizePlan(plan: ScenePlan, length: number): ScenePlan {
  const keepSources = plan.scenes.some((scene) => scene.type === "sources");
  const scenes = plan.scenes.filter((scene) => scene.type !== "sources");
  if (keepSources) {
    scenes.push({
      type: "sources",
      headline: "Sources",
      narration: "The numbers in this video come from these sources.",
      factIds: [],
      quote: null,
      durationSec: 4,
    });
  }

  if (length <= 2) {
    return { ...plan, scenes: fitScenesToFrames(scenes, length * FPS) };
  }

  const total = scenes.reduce((sum, s) => sum + s.durationSec, 0);
  const factor = total > 0 ? length / total : 1;
  return {
    ...plan,
    scenes: scenes.map((s) => ({
      ...s,
      durationSec: clamp(Math.round(s.durationSec * factor * 2) / 2, 2, 12),
    })),
  };
}

/** Splits a short test video into whole frames that add up to the target. */
function fitScenesToFrames(scenes: Scene[], totalFrames: number): Scene[] {
  const frames = Math.max(totalFrames, scenes.length);
  const base = Math.floor(frames / scenes.length);
  let extra = frames - base * scenes.length;
  return scenes.map((scene) => {
    const sceneFrames = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    return { ...scene, durationSec: sceneFrames / FPS };
  });
}

/** Placeholders need unique snake_case ids; models occasionally repeat or misformat them. */
function dedupeFactIds(research: Research): Research {
  const seen = new Set<string>();
  const facts = research.facts.map((fact) => {
    let id = fact.id.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "f_");
    while (seen.has(id)) id = `${id}_2`;
    seen.add(id);
    return { ...fact, id };
  });
  return { ...research, facts };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
