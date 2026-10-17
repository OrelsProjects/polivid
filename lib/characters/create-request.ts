import "server-only";
import { z } from "zod";
import { MAX_CHARACTER_NAME, MAX_IMAGE_PROMPT, MAX_VOICE_DESCRIPTION } from "./constants";
import { createCharacter } from "./store";

const Schema = z.object({
  name: z.string().trim().min(2).max(MAX_CHARACTER_NAME),
  imageKey: z.string().trim().min(1),
  imagePrompt: z.string().trim().max(MAX_IMAGE_PROMPT).optional().default(""),
  voiceMode: z.enum(["none", "designed"]).optional().default("none"),
  generatedVoiceId: z.string().trim().optional().default(""),
  voiceDescription: z.string().trim().max(MAX_VOICE_DESCRIPTION).optional().default(""),
});

/** Saves a character from fields instead of a multipart form. Recorded voices stay on the Characters page. */
export const createCharacterFromInput = async (userId: string, raw: unknown) => {
  const parsed = Schema.parse(raw);
  return createCharacter(userId, parsed);
};
