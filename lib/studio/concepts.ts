import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import { MIN_CONCEPT_WORDS, wordCount, type SavedConcept } from "./source-types";

const SUGGEST_MODEL = "anthropic/claude-haiku-5.5";

const ConceptSchema = z.object({
  concepts: z
    .array(
      z.object({
        title: z.string(),
        shape: z.string(),
        angle: z.string(),
        passage: z.string(),
        script: z.string(),
      }),
    )
    .max(3),
});

export class ConceptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConceptError";
  }
}

/** Up to three source-linked ideas. Fewer when the writing cannot support more. Never padded. */
export async function suggestConcepts(body: string): Promise<SavedConcept[]> {
  const text = body.trim();
  if (wordCount(text) < MIN_CONCEPT_WORDS) {
    throw new ConceptError(
      `This is ${wordCount(text)} words. That is enough for one video, not for a set of distinct concepts.`,
    );
  }
  if (!hasOpenRouterKey()) {
    throw new ConceptError("Concept suggestions need an OpenRouter key. Make one video from the text instead.");
  }

  const result = await generateText({
    model: openrouter().chat(SUGGEST_MODEL),
    instructions:
      "Turn the writing into at most three short-video concepts. Each concept must be a different angle that the text actually supports. Return one or two when a third would be invented. Quote a short passage that appears in the writing. Write a speakable script of 40 to 90 words. Do not add facts that are not in the writing.",
    prompt: text.slice(0, 12000),
    output: Output.object({ schema: ConceptSchema, name: "concepts" }),
  });

  return result.output.concepts.slice(0, 3).map((concept, index) => ({
    id: `c${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
    title: concept.title.slice(0, 120),
    shape: concept.shape.slice(0, 40),
    angle: concept.angle.slice(0, 240),
    passage: concept.passage.slice(0, 400),
    script: concept.script.slice(0, 2000),
    videoId: null,
  }));
}
