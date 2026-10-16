import { capabilityById } from "../capabilities";
import { toneWav } from "../placeholder-media";
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

let voices: { id: string; name: string }[] | null = null;

const listVoices = async () => {
  if (voices) return voices;
  const response = await fetch(`${BASE}/v1/voices`, { headers: { "xi-api-key": key() } });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ElevenLabs voices failed (${response.status}). ${detail.slice(0, 160)}`);
  }
  const json = (await response.json()) as { voices?: { voice_id: string; name: string }[] };
  voices = (json.voices ?? []).map((voice) => ({ id: voice.voice_id, name: voice.name }));
  return voices;
};

export const resolveVoiceId = async (requested?: string) => {
  const raw = requested?.trim() || "Maya";
  if (/^[a-zA-Z0-9]{16,}$/.test(raw)) return raw;
  const needle = raw.replace(/-en$/i, "").replace(/^voice[_-]?/i, "").toLowerCase();
  const listed = await listVoices();
  const match =
    listed.find((voice) => voice.name.toLowerCase() === needle) ??
    listed.find((voice) => voice.name.toLowerCase().includes(needle));
  if (match) return match.id;
  if (listed[0]) return listed[0].id;
  throw new Error("No ElevenLabs voices on this account.");
};

/** Cloned voices stay close to the recording. Other speech keeps the provider default. */
export const speechRequestBody = (text: string, modelId: string, settings?: Record<string, unknown>) => {
  const body: Record<string, unknown> = { text, model_id: modelId };
  if (settings?.cloned === true) {
    body.voice_settings = {
      stability: 0.42,
      similarity_boost: 0.86,
      style: 0.12,
      use_speaker_boost: true,
    };
  }
  return body;
};

export const addInstantVoice = async (input: {
  name: string;
  description: string;
  files: { bytes: Uint8Array; filename: string; type: string }[];
}) => {
  const form = new FormData();
  form.set("name", input.name);
  form.set("description", input.description);
  form.set("remove_background_noise", "true");
  for (const file of input.files) {
    form.append("files", new Blob([file.bytes as BlobPart], { type: file.type }), file.filename);
  }
  const response = await fetch(`${BASE}/v1/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": key() },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(voiceAddMessage(response.status, detail));
  }
  const json = (await response.json()) as { voice_id?: string; requires_verification?: boolean };
  if (!json.voice_id) throw new Error("The voice service didn't return a voice.");
  if (json.requires_verification) {
    await deleteInstantVoice(json.voice_id).catch(() => undefined);
    throw new Error("This voice needs verification on ElevenLabs before it can be used.");
  }
  voices = null;
  return json.voice_id;
};

export interface DesignedVoicePreview {
  generatedVoiceId: string;
  audioBase64: string;
}

export const designVoicePreviews = async (description: string, sampleText: string) => {
  const response = await fetch(`${BASE}/v1/text-to-voice/design`, {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_description: description,
      text: sampleText,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(voiceAddMessage(response.status, detail));
  }
  const json = (await response.json()) as {
    previews?: { generated_voice_id?: string; audio_base_64?: string }[];
  };
  const previews = (json.previews ?? [])
    .filter((preview): preview is { generated_voice_id: string; audio_base_64: string } =>
      Boolean(preview.generated_voice_id && preview.audio_base_64),
    )
    .map((preview) => ({
      generatedVoiceId: preview.generated_voice_id,
      audioBase64: preview.audio_base_64,
    }));
  if (previews.length === 0) throw new Error("The voice service didn't return any previews.");
  return previews;
};

export const saveDesignedVoice = async (input: { name: string; description: string; generatedVoiceId: string }) => {
  const response = await fetch(`${BASE}/v1/text-to-voice`, {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_name: input.name,
      voice_description: input.description,
      generated_voice_id: input.generatedVoiceId,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(voiceAddMessage(response.status, detail));
  }
  const json = (await response.json()) as { voice_id?: string };
  if (!json.voice_id) throw new Error("The voice service didn't return a voice.");
  voices = null;
  return json.voice_id;
};

export const deleteInstantVoice = async (voiceId: string) => {
  const response = await fetch(`${BASE}/v1/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": key() },
  });
  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Couldn't remove that voice (${response.status}). ${detail.slice(0, 160)}`);
  }
  voices = null;
};

const voiceAddMessage = (status: number, detail: string) => {
  if (status === 401) return "The voice service rejected the API key.";
  if (status === 402 || /paid_plan_required|quota|voice_limit/i.test(detail)) {
    return "The voice service needs a paid plan, or this account is out of voice slots.";
  }
  if (/audio|sample|duration|too short|empty/i.test(detail)) {
    return "Those recordings were too short or too quiet. Say each line all the way through.";
  }
  return `Couldn't create that voice (${status}).`;
};

const postAudio = async (path: string, body: unknown, idempotencyKey: string) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ElevenLabs request failed (${response.status}). ${detail.slice(0, 180)}`);
  }
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
    const voiceId = await resolveVoiceId(request.voiceId);
    const chunks = splitDialogue(text);
    const parts: Uint8Array[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const path = `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
      const models = [request.modelId || "eleven_multilingual_v2", "eleven_multilingual_v2", "eleven_turbo_v2_5"];
      let bytes = new Uint8Array();
      let lastError: Error | null = null;
      for (const modelId of [...new Set(models)]) {
        try {
          const result = await postAudio(
            path,
            speechRequestBody(chunk, modelId, request.settings),
            `${idempotencyKey}:${index}:${modelId}`,
          );
          bytes = result.bytes;
          if (bytes.byteLength > 0) break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("ElevenLabs request failed.");
        }
      }
      if (bytes.byteLength === 0) throw lastError ?? new Error("ElevenLabs returned no audio.");
      parts.push(bytes);
    }
    const combined = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.byteLength;
    }
    if (combined.byteLength === 0) throw new Error("ElevenLabs returned no audio.");
    return done(idempotencyKey, combined, "audio/mpeg", chunks.length * 0.02, { durationSec: request.durationSec ?? null, chunks: chunks.length });
  },
  poll: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
  collect: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
});

export const musicComposeBody = (request: { prompt: string; durationSec?: number }) => {
  const musicLengthMs = Math.min(600_000, Math.max(3_000, Math.round((request.durationSec ?? 20) * 1000)));
  return {
    model_id: "music_v2_5" as const,
    prompt: request.prompt,
    music_length_ms: musicLengthMs,
    force_instrumental: true,
  };
};

export const isElevenLabsPaidPlanRequired = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /paid_plan_required|not available for free users|ElevenLabs request failed \(402\)|concurrent_limit_exceeded|ElevenLabs request failed \(429\)/i.test(message);
};

const localBed = (idempotencyKey: string, durationSec: number, frequencyHz: number) =>
  done(idempotencyKey, toneWav(durationSec, frequencyHz), "audio/wav", 0);

export const createElevenMusicAdapter = (): MediaAdapter => ({
  id: "eleven-music",
  estimate: (request) => (request.durationSec ?? 20) * (capabilityById("music-v2-5")?.pricing.usd ?? 0.02),
  submit: async (request, idempotencyKey) => {
    try {
      const { bytes, mime } = await postAudio("/v1/music", musicComposeBody({ prompt: request.prompt, durationSec: request.durationSec }), idempotencyKey);
      if (bytes.byteLength === 0) throw new Error("ElevenLabs returned no music.");
      return done(idempotencyKey, bytes, mime, (request.durationSec ?? 20) * 0.02);
    } catch (error) {
      if (isElevenLabsPaidPlanRequired(error)) return localBed(idempotencyKey, request.durationSec ?? 20, 196);
      throw error;
    }
  },
  poll: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
  collect: async (id) => done(id, new Uint8Array(), "audio/mpeg", 0),
});

/** ElevenLabs only accepts sound effects between 0.5 and 30 seconds long. */
export const sfxGenerationBody = (request: { prompt: string; durationSec?: number }) => ({
  text: request.prompt,
  duration_seconds: Math.min(30, Math.max(0.5, request.durationSec ?? 2)),
  model_id: "eleven_text_to_sound_v2" as const,
});

export const createElevenSfxAdapter = (): MediaAdapter => ({
  id: "eleven-sfx",
  estimate: (request) => (request.durationSec ?? 2) * (capabilityById("sfx-eleven")?.pricing.usd ?? 0.01),
  submit: async (request, idempotencyKey) => {
    try {
      const { bytes, mime } = await postAudio("/v1/sound-generation", sfxGenerationBody(request), idempotencyKey);
      if (bytes.byteLength === 0) throw new Error("ElevenLabs returned no sound.");
      return done(idempotencyKey, bytes, mime, (request.durationSec ?? 2) * 0.01);
    } catch (error) {
      if (isElevenLabsPaidPlanRequired(error)) return localBed(idempotencyKey, request.durationSec ?? 2, 110);
      throw error;
    }
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
