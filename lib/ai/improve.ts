import "server-only";
import { generateText } from "ai";
import { IMPROVE_INSTRUCTIONS } from "./prompts";
import { openrouter } from "./openrouter";

/** Improve with AI stays on Sonnet. POLIVID_MODEL does not change this call. */
const IMPROVE_MODEL = "anthropic/claude-sonnet-5.5";

/** Rewrites a short description into one spoken narration paragraph. */
export const improveNarration = async (description: string) => {
  const result = await generateText({
    model: openrouter().chat(IMPROVE_MODEL),
    instructions: IMPROVE_INSTRUCTIONS,
    prompt: `Description: ${description}\nScript:`,
  });
  const script = result.text.trim().replace(/^script:\s*/i, "").trim();
  if (!script) throw new Error("The model returned an empty script.");
  return script;
};
