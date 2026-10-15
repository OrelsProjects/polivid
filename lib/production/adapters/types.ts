import type { ReferenceRole } from "../schema";

export interface AdapterRef {
  role: ReferenceRole;
  bytes?: Uint8Array;
  mime?: string;
  url?: string;
}

/** A still pulled from footage, for reviewers that need to see what actually happened. */
export interface AdapterFrame {
  timeSec: number;
  bytes: Uint8Array;
  mime: string;
}

export interface AdapterRequest {
  modelId: string;
  prompt: string;
  durationSec?: number;
  format?: string;
  resolution?: string;
  refs?: AdapterRef[];
  /** Sampled frames of the clip under review, in time order. */
  frames?: AdapterFrame[];
  audioBytes?: Uint8Array;
  videoBytes?: Uint8Array;
  text?: string;
  voiceId?: string;
  language?: string;
  syncMode?: "cut_off" | "loop" | "bounce" | "silence";
  interactionContext?: unknown;
  compositionPlan?: unknown;
  settings?: Record<string, unknown>;
}

export interface AdapterOutput {
  mime: string;
  bytes?: Uint8Array;
  url?: string;
  json?: unknown;
}

export interface AdapterJob {
  providerJobId: string;
  status: "in_progress" | "completed" | "failed" | "expired";
  outputs: AdapterOutput[];
  usage: { usd: number; units: Record<string, number> };
  interactionContext?: unknown;
  extensionSpan?: "full" | "new_only";
  error?: string;
}

export interface MediaAdapter {
  id: string;
  estimate: (request: AdapterRequest) => number;
  submit: (request: AdapterRequest, idempotencyKey: string) => Promise<AdapterJob>;
  poll: (providerJobId: string) => Promise<AdapterJob>;
  collect: (providerJobId: string) => Promise<AdapterJob>;
}
