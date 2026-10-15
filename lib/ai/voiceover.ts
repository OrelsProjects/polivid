import "server-only";
import { generateText } from "ai";
import { openrouter } from "./openrouter";

const VOICEOVER_MODEL = "anthropic/claude-sonnet-5.5";

const looksLikeUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

/** Turns a script or article URL into one spoken paragraph that fits the clip. */
export const writeVoiceover = async (source: string, length: number) => {
  const words = Math.min(220, Math.max(20, Math.round(length * 2.4)));
  const fromUrl = looksLikeUrl(source);
  const result = await generateText({
    model: openrouter().chat(VOICEOVER_MODEL, fromUrl ? { plugins: [{ id: "web", max_results: 4 }] } : undefined),
    instructions: `You write spoken voiceover for a short video. Return one paragraph of narration and nothing else. About ${words} words, roughly ${length} seconds when read aloud. Short sentences. No titles, labels, camera directions, or quotes around the script.`,
    prompt: fromUrl
      ? `Read this page and write a voiceover that covers the main point:\n${source.trim()}`
      : `Turn this into a spoken voiceover:\n${source.trim()}`,
  });
  const script = result.text.trim().replace(/^["']|["']$/g, "").trim();
  if (!script) throw new Error("Couldn't write that voiceover.");
  return script;
};
