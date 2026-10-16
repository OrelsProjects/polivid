import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";

const BEAT_MODEL = "anthropic/claude-haiku-5.5";

const BeatsSchema = z.object({
  beats: z.array(z.string().min(1)),
});

/** One short continuation prompt per clip. Skipped by the caller when there is only one clip. */
export const writeBeats = async (input: {
  prompt: string;
  segments: readonly number[];
  mode?: string;
}): Promise<string[]> => {
  const source = input.prompt.trim();
  if (input.segments.length <= 1) return [source];
  if (!source || !hasOpenRouterKey()) return fallbackBeats(source, input.segments);

  try {
    const result = await generateText({
      model: openrouter().chat(BEAT_MODEL),
      instructions: beatInstructions(input.mode, input.segments.length),
      prompt: `Clip lengths in order, in seconds: ${input.segments.join(", ")}.\n\nRequest:\n${source}`,
      output: Output.object({ schema: BeatsSchema, name: "beats" }),
    });
    const beats = result.output.beats.map((beat) => beat.trim()).filter(Boolean);
    if (beats.length === input.segments.length) return beats;
  } catch (error) {
    console.error("Could not split the prompt into beats.", error);
  }
  return fallbackBeats(source, input.segments);
};

const beatInstructions = (mode: string | undefined, count: number) => {
  const shared = `Return exactly ${count} beats. Each beat is one short prompt for one clip. Beat 2 continues from where beat 1 ended. Stay in the same scene. Do not number the beats. No titles or labels.`;
  if (mode === "voiceover") {
    return `You split a spoken narration across consecutive video clips. Keep every sentence in order and do not rewrite the meaning. Each beat is the lines spoken during that clip. ${shared}`;
  }
  if (mode === "lyrics") {
    return `You split lyrics across consecutive music-video clips. Keep the lyric order. Each beat is the lines sung during that clip. ${shared}`;
  }
  if (mode === "song") {
    return `You write one visual shot for each clip of a music video. The song already exists, so do not mention singing, lyrics, captions, or on-screen words. Each beat is only what the camera shows. ${shared}`;
  }
  return `You split one video request into consecutive clips that will be filmed in order. Each beat is one action. ${shared}`;
};

const fallbackBeats = (prompt: string, segments: readonly number[]) =>
  segments.map((seconds, index) =>
    index === 0 ? prompt : `Continue the same scene for the next ${seconds} seconds. ${prompt}`,
  );
