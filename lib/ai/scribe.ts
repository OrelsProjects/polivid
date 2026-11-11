import "server-only";
import { randomUUID } from "node:crypto";
import { createScribeAdapter } from "@/lib/production/adapters/elevenlabs";
import { parseTimedWords, type TimedWord } from "@/lib/video/captions";

export const hasScribe = () => Boolean(process.env.ELEVENLABS_API_KEY?.trim());

/**
 * Transcribes speech and returns each word with the time it is spoken.
 * `audio` is an MP3. Throws when the service is not set up or returns no words.
 */
export const transcribeWords = async (audio: Uint8Array): Promise<{ text: string; words: TimedWord[] }> => {
  if (!hasScribe()) throw new Error("Speech-to-text is not set up on this server.");
  const job = await createScribeAdapter().submit(
    { modelId: "scribe-v2", prompt: "", audioBytes: audio },
    randomUUID(),
  );
  const reply = job.outputs[0]?.json;
  const words = parseTimedWords(reply);
  const text =
    reply && typeof reply === "object" && typeof (reply as { text?: unknown }).text === "string"
      ? (reply as { text: string }).text.trim()
      : words.map((word) => word.text).join(" ");
  if (words.length === 0) throw new Error("No speech was found in that file.");
  return { text, words };
};
