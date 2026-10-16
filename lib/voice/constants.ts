export const STUDIO_VOICE_ID = "studio";
export const OFF_VOICE_ID = "off";
export const MAX_VOICE_NAME = 40;
export const MAX_SAVED_VOICES = 20;
export const MIN_SAMPLE_BYTES = 1_500;
export const MAX_SAMPLE_BYTES = 8_000_000;
export const MAX_SAMPLE_SECONDS = 30;

/** Songs re-sing the vocal in this voice, so the clone needs real singing, not only speech. */
export const SAMPLE_PROMPTS = [
  {
    id: "news",
    kind: "speak",
    label: "Straight",
    text: "This morning I finally tried the little coffee place on the corner. The line was out the door, the music was loud, and the croissants were gone by nine.",
    minSeconds: 8,
  },
  {
    id: "turn",
    kind: "speak",
    label: "A turn",
    text: "Wait, look at this. See how the light hits the water right here? That's the shot. Everything before it was practice. Everything after it is the good part.",
    minSeconds: 8,
  },
  {
    id: "close",
    kind: "speak",
    label: "The point",
    text: "If you remember one thing, remember this: start small, and keep going. Nobody gets it right on the first try. Make something today, and make it better tomorrow.",
    minSeconds: 8,
  },
  {
    id: "easy",
    kind: "speak",
    label: "Relaxed",
    text: "Honestly, it's simpler than it sounds. You write it once, you hit share, and you get on with your day. That's it. No tricks, no fine print, nothing to set up.",
    minSeconds: 8,
  },
  {
    id: "sing",
    kind: "sing",
    label: "Sing",
    text: "Sing any song you know well, like a chorus you love or Happy Birthday. Sing it out at your normal volume, no music playing.",
    minSeconds: 12,
  },
  {
    id: "sing-high",
    kind: "sing",
    label: "Sing it big",
    text: "Sing again with more energy, a little higher, like the big final chorus. Hold a few long notes.",
    minSeconds: 12,
  },
] as const;

const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/aac",
  "video/webm",
]);

const VOICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prompt, voiceover, image, and lyrics can carry a voice track. */
export const modeCanNarrate = (mode?: string | null) =>
  !mode || mode === "prompt" || mode === "voiceover" || mode === "image" || mode === "lyrics";

export const defaultVoiceForMode = (mode?: string | null) =>
  mode === "voiceover" ? STUDIO_VOICE_ID : OFF_VOICE_ID;

export const isCharacterId = (value: unknown): value is string =>
  value === OFF_VOICE_ID || value === STUDIO_VOICE_ID || (typeof value === "string" && VOICE_ID.test(value));

export const isVoiceSettingId = isCharacterId;
export const defaultCharacterForMode = defaultVoiceForMode;

export const cleanVoiceName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, MAX_VOICE_NAME);

export const audioSampleType = (type: string, name: string) => {
  const normalized = type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (AUDIO_TYPES.has(normalized)) return normalized;
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "webm") return "audio/webm";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a" || ext === "mp4" || ext === "aac") return "audio/mp4";
  if (ext === "ogg") return "audio/ogg";
  return "";
};

export const validateSamples = (files: { size: number; type: string; name: string }[]) => {
  if (files.length !== SAMPLE_PROMPTS.length) {
    return `Record all ${SAMPLE_PROMPTS.length} parts.`;
  }
  for (const [index, file] of files.entries()) {
    if (!audioSampleType(file.type, file.name)) return `Part ${index + 1} needs to be an audio recording.`;
    if (file.size < MIN_SAMPLE_BYTES) return `Part ${index + 1} is too short. Record the whole part.`;
    if (file.size > MAX_SAMPLE_BYTES) return `Part ${index + 1} is too long. Keep each take under thirty seconds.`;
  }
  return null;
};

export const extensionForSample = (type: string) => {
  if (type.includes("mp4") || type.includes("aac")) return "m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  return "webm";
};
