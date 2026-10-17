import type { z } from "zod";

/** What the tool is for. The catalog and the Coach's tool index are grouped by this. */
export const TOOL_CATEGORIES = [
  "make",
  "plan",
  "assets",
  "library",
  "jobs",
  "editor",
  "account",
  "navigate",
  "ask",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  make: "Make",
  plan: "Plan",
  assets: "Assets",
  library: "Library",
  jobs: "Jobs",
  editor: "Editor",
  account: "Account",
  navigate: "Navigate",
  ask: "Ask",
};

/**
 * Side effects, named so a future MCP adapter can copy them onto tool annotations.
 * `readOnly` maps to `readOnlyHint`, `destructive` to `destructiveHint`.
 * A tool that changes something outside the chat is not read-only, so `openWorldHint` is the opposite of `readOnly`.
 */
export interface ToolEffects {
  readOnly: boolean;
  spendsCredits: boolean;
  destructive: boolean;
  longRunning: boolean;
}

export interface ToolExample {
  request: string;
  input: Record<string, unknown>;
}

/**
 * One capability the Coach (and, later, MCP) can call.
 * Definitions stay free of server code so the browser can read titles and approval text.
 */
export interface ToolDefinition {
  /** Stable snake_case name. Never rename a tool that a saved chat may mention. */
  name: string;
  /** Short label for approval cards, action cards, and the catalog. */
  title: string;
  category: ToolCategory;
  /** One line on what the tool does. */
  summary: string;
  /** When the Coach should pick this tool instead of another. */
  whenToUse: string[];
  /** Common wrong picks, and what to do instead. */
  avoidWhen?: string[];
  /** Every field should have a `.describe()`, so the model and the catalog know what to pass. */
  inputSchema: z.ZodType;
  effects: ToolEffects;
  /** `user` shows an approval card and blocks the call until the person accepts. */
  approval: "none" | "user";
  /**
   * `server` runs in the request. `client` is finished in the browser.
   * Ask tools are `client` plus `awaitsPerson`: the person answers, and nothing runs automatically.
   */
  runsOn: "server" | "client";
  awaitsPerson?: boolean;
  surfaces: ("coach" | "mcp")[];
  /**
   * `legacy` tools stay registered so old chats still validate, but the model does not see them
   * and they are left out of the tool index and the catalog.
   */
  status?: "live" | "legacy";
  /** The line under the approval card title. */
  approvalDetail?: (input: Record<string, unknown>) => string;
  /** Create mode this tool queues. Used to price the call before it runs. */
  videoMode?: string;
  examples?: ToolExample[];
}

export type AttachedMediaKind = "image" | "audio" | "video";

export interface AttachedMedia {
  key: string;
  kind: AttachedMediaKind;
}

/** Everything a tool handler is allowed to know about the current turn. */
export interface ToolContext {
  userId: string;
  /** Chat this turn belongs to, when the Coach is the caller. */
  threadId?: string;
  /** Editor project linked to that chat, once the video is ready. */
  projectId?: string;
  /** Picture keys from "Attached reference pictures:" notes. */
  attachedReferenceKeys: readonly string[];
  /** Character id from "Attached character:" notes. Empty when they did not pick one. */
  attachedCharacterId: string;
  /** Pictures, audio, and video the person attached in this chat. */
  attachedMedia: readonly AttachedMedia[];
  timezone: string;
}

export type ToolHandler = (input: unknown, ctx: ToolContext) => Promise<unknown>;
