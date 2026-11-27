import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, MODEL, openrouter } from "@/lib/ai/openrouter";
import { filmSecondsFor } from "./shot-plan";
import { MAX_SKIT_HOLD, MAX_SKIT_SHOT, MAX_SKIT_SOUND, skitBeats, type SkitBeat, type SkitPlanShot } from "./skit";
import { countWords, WORDS_PER_SECOND } from "./stills";

export class SkitPlanError extends Error {}

const PlanSchema = z.object({
  shots: z.array(
    z.object({
      shot: z.string(),
      hold: z.number(),
      sound: z.string(),
    }),
  ),
});

/**
 * How the director plans a skit. The writer's notes and words stay theirs: the director turns each
 * beat into one filmable shot, times it, and decides whether it needs a sound.
 */
const instructions = (input: { target: number | null }) =>
  [
    "You direct short comedy skits for social video. Each beat of the script is filmed as one separate shot by an AI video model (Kling).",
    "The video model never sees the script. The character's voice reads the whole script in one continuous take afterwards, and each shot is on screen exactly while its beat's line is heard. You write what the model films.",
    "",
    "For every beat, in order, write:",
    "",
    "shot: one vivid shot description for the video model, 40 to 90 words, in present tense.",
    "- The writer's note for the beat is the heart of the shot. Keep everything it asks for and expand it into something filmable: what the character does from the first frame to the last, where it happens and the props it needs (only what the note and line imply), the framing and how the camera moves, and the comic timing: the build, the payoff, the reaction.",
    "- A beat with no note: give the character one simple physical action that shows the line, without speaking it.",
    "- Big, clear, physical comedy reads best: exaggerated reactions, things going wrong, small victories.",
    "- Call the character by the name the writer uses, or 'the character'. Never describe their face, body, clothes, colours or art style: their pictures set that.",
    "- Nobody talks on camera. No on-screen text, captions, letters, numbers or logos. No real people or brands.",
    "",
    "- The shot lasts only as long as its line takes to say (given for each beat), so the action must fit in that time: one clear action for a short line, a small build and payoff for a longer one. Start the action in the first second.",
    "",
    `hold: seconds the shot stays on screen after its line, with no voice, from 0 to ${MAX_SKIT_HOLD}. The voice sets the length, so hold is 0 for almost every shot. Give a hold only when the writer's note or direction asks for one (a pause, a beat, a long stare, a reaction that plays out, "holds for 3 seconds")${input.target ? ", or to reach the length the writer asked for" : ""}. A pause the script already marks is added for you; don't add it again.`,
    input.target
      ? `The writer wants the whole skit to run about ${input.target} seconds. The lines take the time given for each beat; if that falls short, add holds where a reaction or a payoff earns the time. Never shorten a line.`
      : "",
    "",
    "sound: one short sound effect, only when a distinct physical event in the shot makes a sound that helps the joke land: a whoosh, a bonk, a door slam, a splash, applause. Leave it empty otherwise. Most shots have none. Never music, never speech or voices.",
    "",
    "Follow the writer's direction for the look and the pace. Fast paced means quick, snappy action and no holds. Slow or cinematic means calmer camera moves and longer reactions.",
    "Return exactly one shot per beat, in the same order.",
  ].join("\n");

/** Seconds a beat's line takes to say, about, before the voice is read. */
const sayingSeconds = (say: string) => Math.max(1, Math.ceil(countWords(say) / WORDS_PER_SECOND));

/** The length a shot is filmed and priced at: its line, the script's pause after it, and its hold. */
const plannedSeconds = (beat: SkitBeat, hold: number, durations: readonly number[]) =>
  filmSecondsFor(Math.ceil(countWords(beat.say) / WORDS_PER_SECOND + beat.pause + hold), durations);

const holdOf = (value: number) => (Number.isFinite(value) ? Math.min(MAX_SKIT_HOLD, Math.max(0, Math.round(value * 2) / 2)) : 0);

/**
 * Plans a skit: one full shot per beat of the script, its length and its sound. The beats and their
 * words come from the script and never change; only how each is filmed is planned.
 */
export const planSkit = async (input: {
  script: string;
  durations: readonly number[];
  direction?: string;
  /** Seconds the whole skit should run, or null to leave it to the plan. */
  target?: number | null;
  /** The drawn look, if any, so the shots fit it. */
  lookName?: string | null;
}): Promise<SkitPlanShot[]> => {
  const beats = skitBeats(input.script, input.durations);
  if (beats.length === 0) throw new SkitPlanError("Write the words to say.");
  if (!hasOpenRouterKey()) {
    // No planner available: film each beat as written, as long as its words take.
    return beats.map((beat) => ({
      shot: beat.show || `The character acts out this line, without saying it: "${beat.say}"`,
      seconds: plannedSeconds(beat, 0, input.durations),
      hold: 0,
      sound: "",
    }));
  }
  const target = input.target ?? null;
  const prompt = [
    input.direction?.trim() ? `The writer's direction:\n${input.direction.trim()}` : "The writer gave no direction.",
    input.lookName ? `Look: the character is drawn in this style: ${input.lookName}.` : "",
    "Beats:",
    ...beats.map(
      (beat, index) =>
        `${index + 1}. Note: ${beat.show || "(none)"}\n   Line read over it: "${beat.say}"\n   Saying it takes about ${sayingSeconds(beat.say)} seconds.${beat.pause > 0 ? ` The script holds a ${beat.pause}-second pause after it.` : ""}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  let output: z.infer<typeof PlanSchema>;
  try {
    const result = await generateText({
      model: openrouter().chat(MODEL),
      instructions: instructions({ target }),
      prompt,
      output: Output.object({ schema: PlanSchema, name: "skitPlan" }),
    });
    output = result.output;
  } catch (error) {
    console.error("Could not plan the skit.", error);
    throw new SkitPlanError("Couldn't plan the skit. Try again.");
  }
  if (output.shots.length !== beats.length) throw new SkitPlanError("Couldn't plan the skit. Try again.");
  return beats.map((beat, index) => {
    const planned = output.shots[index]!;
    const hold = holdOf(planned.hold);
    return {
      shot: planned.shot.trim().slice(0, MAX_SKIT_SHOT) || beat.show || beat.say,
      // The voice sets the real length when it's read; this is what the shot is priced at.
      seconds: plannedSeconds(beat, hold, input.durations),
      hold,
      sound: planned.sound.trim().slice(0, MAX_SKIT_SOUND),
    };
  });
};
