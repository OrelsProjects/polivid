import "server-only";
import { isElevenLabsPaidPlanRequired } from "@/lib/production/adapters/elevenlabs";
import { compositionChunks, type SongSectionPlan, type SongWord } from "./song-plan";

const BASE = "https://api.elevenlabs.io";

export interface ComposedSong {
  bytes: Uint8Array;
  words: SongWord[];
  songId: string;
}

const key = () => {
  const value = process.env.ELEVENLABS_API_KEY?.trim();
  if (!value) throw new Error("ELEVENLABS_API_KEY is not set.");
  return value;
};

const summarizeError = (status: number, detail: string) => {
  const error = new Error(`ElevenLabs request failed (${status}). ${detail.slice(0, 180)}`);
  if (isElevenLabsPaidPlanRequired(error)) {
    return new Error("Music needs a paid ElevenLabs plan.");
  }
  return error;
};

interface MultipartPart {
  type: string;
  body: Buffer;
}

const multipartParts = (bytes: Buffer, boundary: string): MultipartPart[] => {
  const marker = Buffer.from(`--${boundary}`);
  const parts: MultipartPart[] = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const start = bytes.indexOf(marker, cursor);
    if (start < 0) break;
    const next = bytes.indexOf(marker, start + marker.length);
    if (next < 0) break;
    const chunk = bytes.subarray(start + marker.length, next);
    const split = chunk.indexOf("\r\n\r\n");
    if (split < 0) {
      cursor = next;
      continue;
    }
    const header = chunk.subarray(0, split).toString("utf8");
    const type = /content-type:\s*([^\r\n;]+)/i.exec(header)?.[1]?.trim() ?? "";
    let body = chunk.subarray(split + 4);
    if (body.subarray(-2).equals(Buffer.from("\r\n"))) body = body.subarray(0, -2);
    parts.push({ type, body });
    cursor = next;
  }
  return parts;
};

const wordsFrom = (json: unknown): SongWord[] => {
  if (!json || typeof json !== "object") return [];
  const list = (json as { words_timestamps?: unknown }).words_timestamps;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const word = item as { word?: unknown; start_ms?: unknown; end_ms?: unknown };
    if (typeof word.word !== "string" || typeof word.start_ms !== "number" || typeof word.end_ms !== "number") return [];
    return [{ text: word.word, startMs: word.start_ms, endMs: word.end_ms }];
  });
};

/** One continuous song for the whole video, with a time for every sung word. */
export const composeSong = async (input: {
  sections: readonly SongSectionPlan[];
  style: string;
  idempotencyKey: string;
}): Promise<ComposedSong> => {
  const response = await fetch(`${BASE}/v1/music/detailed?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
      Accept: "multipart/mixed, application/json, audio/mpeg",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      model_id: "music_v2_5",
      with_timestamps: true,
      composition_plan: { chunks: compositionChunks(input.sections, input.style) },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw summarizeError(response.status, detail);
  }
  const songId = response.headers.get("song-id") ?? "";
  const type = response.headers.get("content-type") ?? "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (type.includes("application/json")) {
    const json = JSON.parse(bytes.toString("utf8")) as { audio?: string };
    const audio = typeof json.audio === "string" ? Buffer.from(json.audio, "base64") : Buffer.alloc(0);
    if (audio.byteLength === 0) throw new Error("ElevenLabs returned no music.");
    return { bytes: new Uint8Array(audio), words: wordsFrom(json), songId };
  }
  const boundary = /boundary=([^;]+)/i.exec(type)?.[1]?.trim();
  if (!boundary) {
    if (bytes.byteLength === 0) throw new Error("ElevenLabs returned no music.");
    return { bytes: new Uint8Array(bytes), words: [], songId };
  }
  const parts = multipartParts(bytes, boundary);
  const jsonPart = parts.find((part) => part.type.includes("json"));
  const audioPart = parts.find((part) => part.type.includes("audio") || part.type.includes("octet-stream"));
  const json = jsonPart ? (JSON.parse(jsonPart.body.toString("utf8")) as unknown) : null;
  const audio = audioPart?.body ?? Buffer.alloc(0);
  if (audio.byteLength === 0) throw new Error("ElevenLabs returned no music.");
  return { bytes: new Uint8Array(audio), words: wordsFrom(json), songId };
};
