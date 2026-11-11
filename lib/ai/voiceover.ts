import "server-only";
import { generateText } from "ai";
import { resolveSourceUrl } from "@/lib/net/source-url";
import { openrouter } from "./openrouter";

const VOICEOVER_MODEL = "anthropic/claude-sonnet-5.5";

const looksLikeUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

/** The text of a public page, or null when it cannot be read and the model's web search should try. */
const readPage = async (url: string) => {
  try {
    const page = await resolveSourceUrl(url.trim(), 9000);
    return page.title ? `${page.title}\n\n${page.text}` : page.text;
  } catch (error) {
    console.error("Could not read the link directly. Falling back to web search.", error);
    return null;
  }
};

/** Turns a script, or the page behind a link, into one spoken paragraph that fits the clip. */
export const writeVoiceover = async (input: string, length: number) => {
  const words = Math.min(220, Math.max(20, Math.round(length * 2.4)));
  // A bare link is read here first. The model's own web search is the fallback when the page won't load.
  const page = looksLikeUrl(input) ? await readPage(input) : null;
  const source = page ?? input;
  const fromUrl = !page && looksLikeUrl(input);
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
