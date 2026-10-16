import "server-only";
import { generateText } from "ai";
import { openrouter } from "./openrouter";

const POLISH_MODEL = "anthropic/claude-haiku-5.5";

/** Rewrites a loose style note into a render-descriptive fragment. */
export const polishPresetFragment = async (description: string) => {
  const result = await generateText({
    model: openrouter().chat(POLISH_MODEL),
    instructions:
      "Rewrite the user's visual style into one or two sentences of render description. Name materials, light, camera, and mood. Do not name a film studio or living artist. Do not write a story or a shot list.",
    prompt: description,
  });
  const fragment = result.text.trim();
  if (!fragment) throw new Error("The model returned an empty style.");
  return fragment;
};
