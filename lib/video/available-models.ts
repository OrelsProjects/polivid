import "server-only";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { hasKlingKey } from "./kling-footage";
import { GENERATION_MODELS, type GenerationModel, type GenerationModelId } from "./models";

/** Google models need GEMINI_API_KEY. Kling models need KLING_API_KEY. OpenRouter models stay listed so demo mode still shows them. */
export const isGenerationModelAvailable = (model: GenerationModel) => {
  if (model.provider === "google") return hasGeminiKey();
  if (model.provider === "kling") return hasKlingKey();
  return true;
};

export const availableGenerationModelIds = (): GenerationModelId[] =>
  GENERATION_MODELS.filter(isGenerationModelAvailable).map((model) => model.id);
