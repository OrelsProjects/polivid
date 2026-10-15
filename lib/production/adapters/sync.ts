import { capabilityById } from "../capabilities";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const BASE = "https://api.sync.so/v2";

const key = () => {
  const value = process.env.SYNC_API_KEY?.trim();
  if (!value) throw new Error("SYNC_API_KEY is not set.");
  return value;
};

export const createPassthroughLipsyncAdapter = (): MediaAdapter => ({
  id: "lipsync-skip",
  estimate: () => 0,
  submit: async (_request, idempotencyKey) => ({
    providerJobId: idempotencyKey,
    status: "completed",
    outputs: [],
    usage: { usd: 0, units: {} },
  }),
  poll: async (providerJobId) => ({
    providerJobId,
    status: "completed",
    outputs: [],
    usage: { usd: 0, units: {} },
  }),
  collect: async (providerJobId) => ({
    providerJobId,
    status: "completed",
    outputs: [],
    usage: { usd: 0, units: {} },
  }),
});

export const createSyncAdapter = (): MediaAdapter => ({
  id: "sync",
  estimate: (request) => (request.durationSec ?? 8) * (capabilityById("lipsync-sync-3")?.pricing.usd ?? 0.08),
  submit: async (request, idempotencyKey) => {
    if (!request.syncMode) {
      throw new Error("sync_mode is required so footage is not looped, reversed, sped up, or truncated.");
    }
    const response = await fetch(`${BASE}/generate`, {
      method: "POST",
      headers: {
        "x-api-key": key(),
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        model: "sync-3",
        input: [
          { type: "video", data: request.videoBytes ? Buffer.from(request.videoBytes).toString("base64") : request.prompt },
          { type: "audio", data: request.audioBytes ? Buffer.from(request.audioBytes).toString("base64") : "" },
        ],
        options: { sync_mode: request.syncMode },
      }),
    });
    if (!response.ok) throw new Error(`Sync request failed (${response.status}).`);
    const json = (await response.json()) as { id?: string; status?: string; outputUrl?: string };
    return {
      providerJobId: json.id ?? idempotencyKey,
      status: json.status === "COMPLETED" ? "completed" : "in_progress",
      outputs: json.outputUrl ? [{ mime: "video/mp4", url: json.outputUrl }] : [],
      usage: { usd: (request.durationSec ?? 8) * 0.08, units: { seconds: request.durationSec ?? 8 } },
    };
  },
  poll: async (providerJobId) => {
    const response = await fetch(`${BASE}/generate/${providerJobId}`, {
      headers: { "x-api-key": key() },
    });
    if (!response.ok) throw new Error(`Sync poll failed (${response.status}).`);
    const json = (await response.json()) as { status?: string; outputUrl?: string };
    const done = json.status === "COMPLETED";
    return {
      providerJobId,
      status: done ? "completed" : json.status === "FAILED" ? "failed" : "in_progress",
      outputs: json.outputUrl ? [{ mime: "video/mp4", url: json.outputUrl }] : [],
      usage: { usd: 0, units: {} },
    };
  },
  collect: async (providerJobId) => {
    const polled = await createSyncAdapter().poll(providerJobId);
    const url = polled.outputs[0]?.url;
    if (!url) return polled;
    const file = await fetch(url);
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { ...polled, outputs: [{ mime: "video/mp4", bytes }] };
  },
});
