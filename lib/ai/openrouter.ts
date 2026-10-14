import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/** PRD default. Override with POLIVID_MODEL to switch models without a code change. */
export const MODEL = process.env.POLIVID_MODEL || "anthropic/claude-opus-5.5";

export const hasOpenRouterKey = () => Boolean(process.env.OPENROUTER_API_KEY);

let provider: ReturnType<typeof createOpenRouter> | null = null;

export const openrouter = () => {
  if (!provider) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    provider = createOpenRouter({ apiKey, compatibility: "strict" });
  }
  return provider;
};
