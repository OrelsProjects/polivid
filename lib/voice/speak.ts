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
import { fitNarrationArgs, mixAudioArgs, pausedNarrationArgs, replaceAudioArgs } from "./narration-filter";
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

/** Pads or trims speech so it lasts as long as the picture. */
export const fitNarration = (speech: Uint8Array, durationSec: number) =>
  runVoiceFfmpeg(speech, durationSec, "fitted.mp3", (audioPath, output, duration) =>
    fitNarrationArgs(audioPath, output, duration),
  );

/**
 * Keeps the footage sound under the voice. A clip with no audio stream gets the voice alone.
 */
export const mixNarration = (video: Uint8Array, speech: Uint8Array, durationSec: number) =>
  mixVideoAudio(video, speech, durationSec);

/** Speaks each beat, fits it to that clip, and joins them so the voice follows the picture. */
export const speakFittedBeats = async (
  userId: string,
  characterId: string | undefined,
  beats: readonly { text: string; seconds: number }[],
) => {
  if (beats.length === 0) return null;
  const parts: Uint8Array[] = [];
  for (const beat of beats) {
    const seconds = Math.max(0.5, beat.seconds);
    if (!beat.text.trim()) {
      parts.push(await silentNarration(seconds));
      continue;
    }
    const speech = await narrationAudio(userId, characterId, beat.text);
    if (!speech) return null;
    parts.push(await fitNarration(speech, seconds));
  }
  return concatNarration(parts);
};

/**
 * Speaks each beat at its natural pace and joins them. Returns how long each beat's
 * speech runs, so the picture can be cut to the voice instead of the voice to the picture.
 * A beat with a pause gets that much silence after its words, reported separately.
 */
export const speakTimedBeats = async (
  userId: string,
  characterId: string | undefined,
  texts: readonly string[],
  /** Called after each beat is spoken. Throw from it to stop. */
  afterBeat?: (done: number, total: number) => Promise<void>,
  /** Seconds of silence to hold after each beat. Missing entries mean none. */
  pauses: readonly number[] = [],
) => {
  const voice = await resolveCharacterVoice(userId, characterId);
  if (!voice) return null;
  const parts: Uint8Array[] = [];
  const spoken: number[] = [];
  const held: number[] = [];
  for (const [index, text] of texts.entries()) {
    const speech = await speakText({ text, voiceId: voice.providerVoiceId, cloned: voice.cloned });
    const seconds = await audioSeconds(speech);
    const pause = pauses[index] ?? 0;
    if (pause > 0) {
      const padded = await runVoiceFfmpeg(speech, pause, "paused.mp3", pausedNarrationArgs);
      parts.push(padded);
      held.push(Math.max(0, (await audioSeconds(padded)) - seconds));
    } else {
      parts.push(speech);
      held.push(0);
    }
    spoken.push(seconds);
    await afterBeat?.(parts.length, texts.length);
  }
  const audio = await concatNarration(parts);
  // Joined MP3 frames can run a few milliseconds off the sum. Rescale so the last cut lands on the last word.
  const total = await audioSeconds(audio);
  const sum = spoken.reduce((all, seconds) => all + seconds, 0) + held.reduce((all, seconds) => all + seconds, 0);
  const scale = sum > 0 && total > 0 ? total / sum : 1;
  return {
    audio,
    seconds: spoken.map((seconds) => seconds * scale),
    pauses: held.map((seconds) => seconds * scale),
  };
};

const audioSeconds = async (bytes: Uint8Array) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-voice-"));
  try {
    const file = path.join(dir, "speech.mp3");
    await writeFile(file, bytes);
    const probe = await probeFile(file);
    if (!(probe.durationSec > 0)) throw new Error("The voice came back empty.");
    return probe.durationSec;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

const silentNarration = (durationSec: number) =>
  runVoiceFfmpeg(new Uint8Array(), durationSec, "silence.mp3", (_audio, output, duration) => [
    "-y",
    "-f",
    "lavfi",
    "-t",
    String(duration),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-c:a",
    "libmp3lame",
    "-q:a",
    "6",
    output,
  ]);

const concatNarration = async (parts: Uint8Array[]) => {
  if (parts.length === 1) return parts[0]!;
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-voice-"));
  try {
    const files = await Promise.all(
      parts.map(async (bytes, index) => {
        const file = path.join(dir, `beat-${index}.mp3`);
        await writeFile(file, bytes);
        return file;
      }),
    );
    const list = path.join(dir, "list.txt");
    await writeFile(list, files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
    const output = path.join(dir, "joined.mp3");
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", output], {
      timeout: 120_000,
    });
    return new Uint8Array(await readFile(output));
  } catch (error) {
    console.error("Could not join the voice beats", error);
    throw new Error("Couldn't add the voice to this video.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

const mixVideoAudio = async (video: Uint8Array, audio: Uint8Array, durationSec: number) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-voice-"));
  try {
    const videoPath = path.join(dir, "picture.mp4");
    const audioPath = path.join(dir, "speech.mp3");
    const output = path.join(dir, "voiced.mp4");
    await writeFile(videoPath, video);
    await writeFile(audioPath, audio);
    const probe = await probeFile(videoPath).catch(() => null);
    const duration = probe?.durationSec && probe.durationSec > 0.4 ? probe.durationSec : durationSec;
    const args = probe?.hasAudio
      ? mixAudioArgs(videoPath, audioPath, output, duration)
      : replaceAudioArgs(videoPath, audioPath, output, duration);
    await execFileAsync("ffmpeg", args, { timeout: 120_000 });
    return new Uint8Array(await readFile(output));
  } catch (error) {
    if (error instanceof Error && /voice|library|say/i.test(error.message)) throw error;
    console.error("Could not add narration", error);
    throw new Error("Couldn't add the voice to this video.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

const runVoiceFfmpeg = async (
  audio: Uint8Array,
  durationSec: number,
  outputName: string,
  argsFor: (audioPath: string, output: string, duration: number) => string[],
) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-voice-"));
  try {
    const audioPath = path.join(dir, "speech.mp3");
    const output = path.join(dir, outputName);
    await writeFile(audioPath, audio);
    await execFileAsync("ffmpeg", argsFor(audioPath, output, durationSec), { timeout: 120_000 });
    return new Uint8Array(await readFile(output));
  } catch (error) {
    console.error("Could not fit narration", error);
    throw new Error("Couldn't add the voice to this video.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
