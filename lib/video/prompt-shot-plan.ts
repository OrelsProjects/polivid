import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import { MAX_CUTS, promptPlanFromOutput, type PromptShotPlan } from "@/lib/video/shot-plan";

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
}): Promise<PromptShotPlan> => {
  const request = input.prompt.trim();
  const context = {
    length: input.length,
    durations: input.durations,
    referenceCount: input.referenceCount,
  };
  if (!request || !hasOpenRouterKey()) return promptPlanFromOutput(null, context);

  const maxSeconds = input.durations.length > 0 ? Math.max(...input.durations) : Math.max(1, Math.round(input.length));
  const direction = input.visualDirection?.trim().slice(0, MAX_VISUAL_DIRECTION) ?? "";
  const style = input.styleNote?.trim() ?? "";
  try {
    const result = await generateText({
      model: openrouter().chat(PLAN_MODEL),
      instructions: promptCutInstructions(Math.max(1, Math.round(input.length)), maxSeconds, input.referenceCount),
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
    return promptPlanFromOutput(result.output, context);
  } catch (error) {
    console.error("Could not plan the prompt shots.", error);
    return promptPlanFromOutput(null, context);
  }
};

const promptCutInstructions = (length: number, maxSeconds: number, referenceCount: number) => {
  const cap = Math.min(MAX_CUTS, length);
  const pictures =
    referenceCount > 0
      ? `attachmentRoles has one entry for every picture, with index from 1 to ${referenceCount}. role is subject, person, product, location, or framing. A subject, person, or product picture belongs on every cut. A location picture belongs on every cut that stays in that place. A framing picture belongs on the cuts that match it. images on a cut lists those 1-based indexes.`
      : "There are no pictures. attachmentRoles is empty, and every cut's images list is empty.";
  return `You divide one video prompt into shots for a video that is exactly ${length} seconds.
The user wrote a single prompt and may have attached pictures. You organise that. Do not ask for more fields.
Return cuts whose seconds add up to ${length}. Each cut is one continuous shot with no cut inside it. One prompt films one shot, so a new scene or camera angle needs its own cut.
seconds is a whole number from 1 to ${Math.min(maxSeconds, length)}.
camera is one line of up to 25 words that always contains three things: the framing and camera move (such as "crash zoom from wide to medium" or "low floor angle rushing in"), what the subject is doing (such as "drops into a crouch, arms spread"), and one visible set detail (such as "under the neon sign"). A cut with a camera move but no subject action is wrong. A cut with a subject action but no framing is wrong. No shot numbers.
Describe every move as already happening at full speed from the first frame of the cut, so it reads within the cut's seconds. A 1-second cut gets one camera move and one subject move, nothing that needs time to build.
Keep continuity between cuts: each cut starts where the previous one ended.
When the prompt names specific moves, gestures, props, or set elements, keep every one of them, spread across different cuts, in the order the prompt gives them. Never drop a named element to shorten a line; drop a generic word instead.
No two consecutive cuts share the same framing size (wide, medium, close) or the same camera move.
When the prompt names a pacing, follow it literally. "A new angle every second" means every cut is 1 second. "Hold the shot" means one long cut.
When the prompt says nothing about pacing, use fewer, longer cuts for a calm scene and shorter cuts for action.
Stay in one location unless the prompt explicitly travels. Do not write lyrics, story narration, or on-screen words.
subject is who or what must stay identical in every shot. setting is the place, time, and light. director is the camera behaviour, pacing, and light for the whole video. style is a short look line only when the prompt asks for one. mustKeep lists details that must not change. mustAvoid lists what the prompt rules out.
${pictures}
Return at most ${cap} cuts.`;
};
