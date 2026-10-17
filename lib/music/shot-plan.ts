import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import { fallbackCuts, MAX_CUTS, normalizeCuts, type ShotCut } from "@/lib/video/shot-plan";

const PLAN_MODEL = "anthropic/claude-haiku-5.5";

const CutsSchema = z.object({
  cuts: z.array(
    z.object({
      seconds: z.number(),
      camera: z.string().optional().default(""),
    }),
  ),
});

/**
 * How many shots the video needs, and how long each one stays on screen.
 * Director notes about pacing are followed literally. With none, the cuts follow the song.
 * One cut is one generated clip: the prompt for that clip does not change scene or angle.
 */
export const planCuts = async (input: {
  lyrics: string;
  style: string;
  direction: string;
  scene: string;
  length: number;
  durations: readonly number[];
}): Promise<ShotCut[]> => {
  const maxSeconds = input.durations.length > 0 ? Math.max(...input.durations) : Math.max(1, Math.round(input.length));
  const fallback = () => fallbackCuts(input.length, input.durations, maxSeconds);
  const lyrics = input.lyrics.trim();
  const style = input.style.trim();
  const direction = input.direction.trim();
  const scene = input.scene.trim();
  if ((!lyrics && !style && !direction) || !hasOpenRouterKey()) return fallback();

  try {
    const result = await generateText({
      model: openrouter().chat(PLAN_MODEL),
      instructions: cutInstructions(Math.max(1, Math.round(input.length)), maxSeconds),
      prompt: [
        style ? `Music: ${style}` : "",
        direction ? `Director notes: ${direction}` : "Director notes: none. Choose the pacing from the music and the lyrics.",
        scene ? `Scene: ${scene}` : "",
        lyrics ? `Lyrics:\n${lyrics}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      output: Output.object({ schema: CutsSchema, name: "cuts" }),
    });
    if (result.output.cuts.length === 0) return fallback();
    return normalizeCuts(result.output.cuts, input.length, maxSeconds);
  } catch (error) {
    console.error("Could not plan the shots.", error);
    return fallback();
  }
};

const cutInstructions = (length: number, maxSeconds: number) => {
  const cap = Math.min(MAX_CUTS, length);
  return `You plan the shots for a music video that is exactly ${length} seconds.
Return cuts whose seconds add up to ${length}. Each cut is one continuous shot with no cut inside it. One prompt films one shot, so a new scene or camera angle needs its own cut.
seconds is a whole number from 1 to ${Math.min(maxSeconds, length)}.
camera is one line of up to 25 words that always contains three things: the framing and camera move (such as "crash zoom from wide to medium" or "low floor angle rushing in"), what the performer is doing (such as "drops into a crouch, arms spread"), and one visible set detail (such as "under the neon sign"). A cut with a camera move but no performer action is wrong. A cut with a performer action but no framing is wrong. No shot numbers.
Describe every move as already happening at full speed from the first frame of the cut, so it reads within the cut's seconds. A 1-second cut gets one camera move and one performer move, nothing that needs time to build.
Keep continuity between cuts: each cut starts where the previous one ended. If he is crouching at the end of a cut, the next cut starts from the crouch. If the hood is up, it stays up until a cut takes it down.
When the director notes name specific moves, gestures, props or set elements, keep every one of them, spread across different cuts, in the order the notes give them. Never drop a named element to shorten a line; drop a generic word instead.
No two consecutive cuts share the same framing size (wide, medium, close) or the same camera move.
When the director notes name a pacing, follow it literally. "A new angle every second" means every cut is 1 second. "Hold each shot for the whole chorus" means one long cut for that part.
When the notes say nothing about pacing, choose the cuts from the song style and the lyric sections. Faster songs and choruses get shorter cuts. Verses can hold longer.
Stay in one location. Do not write lyrics, story, or on-screen words.
Return at most ${cap} cuts.`;
};
