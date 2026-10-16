import { SAMPLE_PROMPTS, cleanVoiceName, validateSamples } from "@/lib/voice/constants";
import { MAX_CHARACTER_NAME, MAX_IMAGE_PROMPT, MAX_VOICE_DESCRIPTION, isVoiceMode, type VoiceMode } from "./constants";

export interface CharacterFields {
  name: string;
  imageKey: string;
  imagePrompt: string;
  voiceMode: VoiceMode;
  generatedVoiceId: string;
  voiceDescription: string;
}

export const parseCharacterFields = (input: {
  name?: unknown;
  imageKey?: unknown;
  imagePrompt?: unknown;
  voiceMode?: unknown;
  generatedVoiceId?: unknown;
  voiceDescription?: unknown;
  requireImage?: boolean;
}): CharacterFields => {
  const name = cleanVoiceName(typeof input.name === "string" ? input.name : "");
  if (name.length < 2 || name.length > MAX_CHARACTER_NAME) throw new Error("Give the character a name.");
  const imageKey = typeof input.imageKey === "string" ? input.imageKey.trim() : "";
  if (input.requireImage !== false && !imageKey) throw new Error("Add a picture of this character.");
  const imagePrompt = typeof input.imagePrompt === "string" ? input.imagePrompt.trim().slice(0, MAX_IMAGE_PROMPT) : "";
  const voiceMode = isVoiceMode(input.voiceMode) ? input.voiceMode : "none";
  const generatedVoiceId = typeof input.generatedVoiceId === "string" ? input.generatedVoiceId.trim() : "";
  const voiceDescription =
    typeof input.voiceDescription === "string" ? input.voiceDescription.trim().slice(0, MAX_VOICE_DESCRIPTION) : "";
  if (voiceMode === "designed") {
    if (!generatedVoiceId) throw new Error("Pick one of the designed voices.");
    if (voiceDescription.length < 8) throw new Error("Describe the voice in a few words.");
  }
  return { name, imageKey, imagePrompt, voiceMode, generatedVoiceId, voiceDescription };
};

export const recordedSamplesProblem = (files: { size: number; type: string; name: string }[]) => {
  if (files.length === 0) return `Record all ${SAMPLE_PROMPTS.length} parts.`;
  return validateSamples(files);
};
