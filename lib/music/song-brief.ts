import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import { readSongBrief, type SongBrief } from "./song-plan";

const BRIEF_MODEL = "anthropic/claude-haiku-5.5";

const BriefSchema = z.object({
  style: z.string(),
  lyrics: z.string(),
});

const INSTRUCTIONS = `You read a request for a song and separate the words to be sung from everything else.

lyrics: only the words the singer sings, copied exactly as the user wrote them. Keep their line breaks, blank lines between stanzas, and section tags like [Verse] or [Chorus]. Do not fix spelling, rhyme, or grammar. Drop instructions, notes, titles, labels like "Lyrics:", and any commentary about the song. When the request has no lyrics at all, write short original lyrics that fit it, with [Verse] and [Chorus] tags.

style: the musical direction as a short comma-separated list, such as genre, mood, tempo, instruments, and vocal type. Each item is a few words. Leave out anything about visuals, video, or captions. Use an empty string when the request gives no musical direction.`;

/** Splits a lyrics-mode prompt into the sung words and the musical style, even when the user wrote full instructions. */
export const extractSongBrief = async (prompt: string): Promise<SongBrief> => {
  const fallback = readSongBrief(prompt);
  if (!hasOpenRouterKey()) return fallback;
  try {
    const result = await generateText({
      model: openrouter().chat(BRIEF_MODEL),
      instructions: INSTRUCTIONS,
      prompt: `Request:\n${prompt.trim()}`,
      output: Output.object({ schema: BriefSchema, name: "song_brief" }),
    });
    const lyrics = result.output.lyrics.trim();
    if (lyrics) return { style: result.output.style.trim(), lyrics };
  } catch (error) {
    console.error("Could not extract the lyrics from the prompt.", error);
  }
  return fallback;
};
