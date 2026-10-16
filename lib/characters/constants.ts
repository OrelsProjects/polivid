export const MAX_CHARACTER_NAME = 40;
export const MAX_SAVED_CHARACTERS = 20;
export const MAX_IMAGE_PROMPT = 400;
export const MAX_VOICE_DESCRIPTION = 400;
export const VOICE_MODES = ["none", "recorded", "designed"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const isVoiceMode = (value: unknown): value is VoiceMode =>
  typeof value === "string" && (VOICE_MODES as readonly string[]).includes(value);
