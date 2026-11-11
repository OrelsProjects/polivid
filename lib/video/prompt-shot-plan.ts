import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import { writeBeats } from "@/lib/video/beats";
import { clipCountFor } from "@/lib/video/segments";
import { fallbackCuts, MAX_CUTS, promptPlanFromOutput, type PromptShotPlan } from "@/lib/video/shot-plan";

const PLAN_MODEL = "anthropic/claude-haiku-5.5";

const PromptPlanSchema = z.object({
  subject: z.string().optional().default(""),
  setting: z.string().optional().default(""),
  director: z.string().optional().default(""),
  style: z.string().optional().default(""),
  mustKeep: z.string().optional().default(""),
  mustAvoid: z.string().optional().default(""),
  attachmentRoles: z
    .array(
      z.object({
        index: z.number(),
        role: z.string(),
      }),
    )
    .optional()
    .default([]),
  cuts: z.array(
    z.object({
      seconds: z.number(),
      camera: z.string().optional().default(""),
      action: z.string().optional().default(""),
      samePlace: z.boolean().optional(),
      images: z.array(z.number()).optional().default([]),
    }),
  ),
});

/**
 * Divides one prompt, and its attachments, into a locked brief and one shot per cut.
 * Nothing is filmed. A failed or empty plan falls back to equal cuts so the gate still appears.
 */
export const planPromptCuts = async (input: {
  prompt: string;
  length: number;
  durations: readonly number[];
  format: string;
  referenceCount: number;
  visualDirection?: string;
  styleNote?: string;
  /** Exact number of shots the person chose. Unset lets the planner decide. */
  clips?: number;
}): Promise<PromptShotPlan> => {
  const request = input.prompt.trim();
  const context = {
    length: input.length,
    durations: input.durations,
    referenceCount: input.referenceCount,
  };
  const maxCut = input.durations.length > 0 ? Math.max(...input.durations) : Math.max(1, Math.round(input.length));
  const clips = input.clips ? clipCountFor(input.length, input.durations, input.clips) : undefined;
  /** A planner that ignored the chosen count gets even cuts of that count instead. */
  const fitCount = (plan: PromptShotPlan): PromptShotPlan =>
    clips && plan.cuts.length !== clips ? { ...plan, cuts: fallbackCuts(input.length, input.durations, maxCut, clips) } : plan;
  const withActions = async (unfitted: PromptShotPlan) => {
    const plan = fitCount(unfitted);
    if (plan.cuts.every((cut) => cut.action?.trim())) return plan;
    const beats = await writeBeats({
      prompt: request,
      segments: plan.cuts.map((cut) => cut.seconds),
      mode: "prompt",
    });
    return {
      ...plan,
      cuts: plan.cuts.map((cut, index) => ({
        ...cut,
        action: cut.action?.trim() || beats[index] || cut.action,
      })),
    };
  };
  if (!request || !hasOpenRouterKey()) return withActions(promptPlanFromOutput(null, context));

  const maxSeconds = input.durations.length > 0 ? Math.max(...input.durations) : Math.max(1, Math.round(input.length));
  const direction = input.visualDirection?.trim().slice(0, MAX_VISUAL_DIRECTION) ?? "";
  const style = input.styleNote?.trim() ?? "";
  try {
    const result = await generateText({
      model: openrouter().chat(PLAN_MODEL),
      instructions: promptCutInstructions(Math.max(1, Math.round(input.length)), maxSeconds, input.referenceCount, clips),
      prompt: [
        `Format: ${input.format}`,
        `Pictures attached: ${Math.max(0, Math.floor(input.referenceCount))}.`,
        direction ? `Visual direction already chosen:\n${direction}` : "",
        style ? `Look already chosen:\n${style}` : "",
        `Prompt:\n${request}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      output: Output.object({ schema: PromptPlanSchema, name: "promptPlan" }),
    });
    return withActions(promptPlanFromOutput(result.output, context));
  } catch (error) {
    console.error("Could not plan the prompt shots.", error);
    return withActions(promptPlanFromOutput(null, context));
  }
};

const promptCutInstructions = (length: number, maxSeconds: number, referenceCount: number, clips?: number) => {
  const cap = Math.min(MAX_CUTS, length);
  const pictures =
    referenceCount > 0
      ? `attachmentRoles has one entry for every picture, with index from 1 to ${referenceCount}. role is subject, person, product, location, storyboard, or framing. A subject, person, or product picture belongs on every cut. A location picture belongs on every cut that stays in that place. A storyboard or framing picture belongs on the cut it matches. images on a cut lists those 1-based indexes.`
      : "There are no pictures. attachmentRoles is empty, and every cut's images list is empty.";
  return `You divide one video prompt into shots for a video that is exactly ${length} seconds.
The user wrote a single prompt and may have attached pictures. You organise that. Do not ask for more fields.
Return cuts whose seconds add up to ${length}. Each cut is one continuous shot with no cut inside it. One prompt films one shot, so a new scene or camera angle needs its own cut.
When the prompt lists beats, follow them in order, one cut per beat. Do not put a later beat's events into an earlier cut.
seconds is a whole number from 1 to ${Math.min(maxSeconds, length)}.
action is one or two sentences of only what happens in this shot. Name only this shot's place and props. Do not mention other beats.
camera is one line of up to 25 words: the framing and camera move, and one visible set detail for this shot. No shot numbers.
samePlace is true only when this shot stays in the same place as the previous shot. The first shot's samePlace is false.
Describe every move as already happening at full speed from the first frame of the cut, so it reads within the cut's seconds. A 1-second cut gets one camera move and one subject move, nothing that needs time to build.
Keep continuity between cuts: each cut starts where the previous one ended.
When the prompt names specific moves, gestures, props, or set elements, keep every one of them, spread across different cuts, in the order the prompt gives them. Never drop a named element to shorten a line; drop a generic word instead.
No two consecutive cuts share the same framing size (wide, medium, close) or the same camera move.
When the prompt names a pacing, follow it literally. "A new angle every second" means every cut is 1 second. "Hold the shot" means one long cut.
When the prompt says nothing about pacing, use fewer, longer cuts for a calm scene and shorter cuts for action.
Stay in one location unless the prompt explicitly travels. Do not write lyrics, story narration, or on-screen words.
subject is who or what must stay identical in every shot. setting is the place, time, and light for the whole video. director is the camera behaviour, pacing, and light for the whole video. style is a short look line only when the prompt asks for one. mustKeep lists identity details that must not change, such as a person's clothes or a creature's look. Never put plot props or story events in mustKeep; those belong in the cut where they happen. mustAvoid lists what the prompt rules out.
${pictures}
A picture the prompt calls a storyboard frame, or "picture N is the framing for beat N", has role storyboard, not framing. A storyboard frame belongs only on the matching cut. role framing is only for a picture that shows composition and must not copy the people.
${
    clips
      ? `Return exactly ${clips} ${clips === 1 ? "cut" : "cuts"}. The person chose this number. This overrides the one-cut-per-beat rule and any pacing in the prompt: combine neighbouring beats into one cut, or continue one beat across cuts, so the count is exact.`
      : `Return at most ${cap} cuts.`
  }`;
};
