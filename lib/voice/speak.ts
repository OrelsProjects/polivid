import "server-only";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createElevenSpeechAdapter } from "@/lib/production/adapters/elevenlabs";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "./constants";
import { replaceAudioArgs } from "./narration-filter";
import { getCharacter } from "@/lib/characters/store";

const execFileAsync = promisify(execFile);

export const PREVIEW_LINE = "This is your voice on a video. It will read the script the same way.";

export const speakText = async (input: { text: string; voiceId: string; cloned: boolean }) => {
  const text = input.text.trim();
  if (!text) throw new Error("There is nothing to say.");
  const job = await createElevenSpeechAdapter().submit(
    {
      modelId: "eleven_multilingual_v2",
      prompt: text,
      text,
      voiceId: input.voiceId,
      settings: input.cloned ? { cloned: true } : undefined,
    },
    randomUUID(),
  );
  const bytes = job.outputs[0]?.bytes;
  if (!bytes || bytes.byteLength === 0) throw new Error("The voice didn't come back.");
  return bytes;
};

/** Studio stays the built-in narrator. A character id must belong to this user. */
export const resolveCharacterVoice = async (userId: string, characterId?: string | null) => {
  const id = characterId?.trim() || OFF_VOICE_ID;
  if (id === OFF_VOICE_ID) return null;
  if (id === STUDIO_VOICE_ID) return { providerVoiceId: "Maya", cloned: false, name: "Studio narrator" };
  const character = await getCharacter(userId, id);
  if (!character) throw new Error("That character isn't in your library.");
  if (!character.providerVoiceId) return null;
  return {
    providerVoiceId: character.providerVoiceId,
    cloned: character.voiceSource === "recorded" || character.voiceSource === "designed",
    name: character.name,
  };
};

export const resolveNarrationVoice = resolveCharacterVoice;

/** Returns speech audio, or null when this video should stay as filmed. */
export const narrationAudio = async (userId: string, characterId: string | undefined, text: string | undefined) => {
  if (!characterId || characterId === OFF_VOICE_ID || !text?.trim()) return null;
  const voice = await resolveCharacterVoice(userId, characterId);
  if (!voice) return null;
  return speakText({ text, voiceId: voice.providerVoiceId, cloned: voice.cloned });
};

export const mixNarration = (video: Uint8Array, speech: Uint8Array, durationSec: number) =>
  replaceVideoAudio(video, speech, durationSec);

const replaceVideoAudio = async (video: Uint8Array, audio: Uint8Array, durationSec: number) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-voice-"));
  try {
    const videoPath = path.join(dir, "picture.mp4");
    const audioPath = path.join(dir, "speech.mp3");
    const output = path.join(dir, "voiced.mp4");
    await writeFile(videoPath, video);
    await writeFile(audioPath, audio);
    const probe = await probeFile(videoPath).catch(() => null);
    const duration = probe?.durationSec && probe.durationSec > 0.4 ? probe.durationSec : durationSec;
    await execFileAsync("ffmpeg", replaceAudioArgs(videoPath, audioPath, output, duration), { timeout: 120_000 });
    return new Uint8Array(await readFile(output));
  } catch (error) {
    if (error instanceof Error && /voice|library|say/i.test(error.message)) throw error;
    console.error("Could not add narration", error);
    throw new Error("Couldn't add the voice to this video.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
