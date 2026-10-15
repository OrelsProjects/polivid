import "server-only";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { GENERATION_MODELS, type GenerationModel, type GenerationModelId } from "./models";

/** Google models need GEMINI_API_KEY. OpenRouter models stay listed so demo mode still shows them. */
export const isGenerationModelAvailable = (model: GenerationModel) => model.provider !== "google" || hasGeminiKey();

export const availableGenerationModelIds = (): GenerationModelId[] =>
  GENERATION_MODELS.filter(isGenerationModelAvailable).map((model) => model.id);
