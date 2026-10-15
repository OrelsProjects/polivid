import { capabilityById } from "../capabilities";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const BASE = "https://api.elevenlabs.io";

const key = () => {
  const value = process.env.ELEVENLABS_API_KEY?.trim();
  if (!value) throw new Error("ELEVENLABS_API_KEY is not set.");
  return value;
};

const MAX_DIALOGUE_CHARS = 5000;

export const splitDialogue = (text: string, limit = MAX_DIALOGUE_CHARS) => {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const breakAt = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "), window.lastIndexOf("\n"));
    const index = breakAt > limit * 0.4 ? breakAt + 1 : limit;
    chunks.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
};

const done = (id: string, bytes: Uint8Array, mime: string, usd: number, json?: unknown): AdapterJob => ({
  providerJobId: id,
  status: "completed",
  outputs: [{ mime, bytes, json }],
  usage: { usd, units: { bytes: bytes.byteLength } },
});

const postAudio = async (path: string, body: unknown, idempotencyKey: string) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`ElevenLabs request failed (${response.status}).`);
  const type = response.headers.get("content-type") ?? "audio/mpeg";
  if (type.includes("application/json")) {
    const json = await response.json();
    return { bytes: new Uint8Array(), mime: "application/json", json };
  }
  return { bytes: new Uint8Array(await response.arrayBuffer()), mime: type, json: undefined };
};

export const createElevenSpeechAdapter = (): MediaAdapter => ({
  id: "eleven-speech",
  estimate: (request) => (request.text?.length ?? 0) * (capabilityById("speech-eleven-v4")?.pricing.usd ?? 0.00003),
  submit: async (request, idempotencyKey) => {
    const text = request.text ?? request.prompt;
    const chunks = splitDialogue(text);
    const parts: Uint8Array[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const { bytes } = await postAudio(
        "/v1/text-to-dialogue",
        {
          model_id: "eleven_v4",
          inputs: [{ text: chunk, voice_id: request.voiceId ?? "default" }],
          language_code: request.language ?? "en",
        },
        `${idempotencyKey}:${index}`,
      );
      parts.push(bytes);
    }
    const combined = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.byteLength;
    }
    return done(idempotencyKey, combined, "audio/mpeg", chunks.length * 0.02, { durationSec: request.durationSec ?? null, chunks: chunks.length });
  },
  poll: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
  collect: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
});

export const createElevenMusicAdapter = (): MediaAdapter => ({
  id: "eleven-music",
  estimate: (request) => (request.durationSec ?? 20) * (capabilityById("music-v2-5")?.pricing.usd ?? 0.02),
  submit: async (request, idempotencyKey) => {
    const { bytes, mime } = await postAudio(
      "/v1/music",
      {
        model_id: "music_v2_5",
        prompt: request.prompt,
        music_length_ms: Math.round((request.durationSec ?? 20) * 1000),
        composition_plan: request.compositionPlan ?? undefined,
      },
      idempotencyKey,
    );
    return done(idempotencyKey, bytes, mime, (request.durationSec ?? 20) * 0.02);
  },
  poll: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
  collect: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
});

export const createElevenSfxAdapter = (): MediaAdapter => ({
  id: "eleven-sfx",
  estimate: (request) => (request.durationSec ?? 2) * (capabilityById("sfx-eleven")?.pricing.usd ?? 0.01),
  submit: async (request, idempotencyKey) => {
    const { bytes, mime } = await postAudio(
      "/v1/sound-generation",
      { text: request.prompt, duration_seconds: request.durationSec ?? 2, model_id: "eleven_text_to_sound_v2" },
      idempotencyKey,
    );
    return done(idempotencyKey, bytes, mime, (request.durationSec ?? 2) * 0.01);
  },
  poll: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
  collect: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
});

export const createScribeAdapter = (): MediaAdapter => ({
  id: "scribe",
  estimate: (request) => (request.durationSec ?? 10) * (capabilityById("scribe-v2")?.pricing.usd ?? 0.003),
  submit: async (request, idempotencyKey) => {
    const form = new FormData();
    form.set("model_id", "scribe_v2");
    if (request.audioBytes) {
      form.set("file", new Blob([request.audioBytes as BlobPart], { type: "audio/mpeg" }), "speech.mp3");
    }
    const response = await fetch(`${BASE}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": key(), "Idempotency-Key": idempotencyKey },
      body: form,
    });
    if (!response.ok) throw new Error(`Scribe request failed (${response.status}).`);
    const json = await response.json();
    return {
      providerJobId: idempotencyKey,
      status: "completed",
      outputs: [{ mime: "application/json", json }],
      usage: { usd: 0.01, units: {} },
    };
  },
  poll: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
  collect: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
});
