import { TOOL_DEFS } from "./defs";
import type { ToolDefinition } from "./types";

export { TOOL_DEFS };
export type { AttachedMedia, ToolContext, ToolDefinition, ToolHandler } from "./types";

const live = (definition: ToolDefinition) => (definition.status ?? "live") === "live";

export const toolByName = (name: string) => TOOL_DEFS.find((definition) => definition.name === name) ?? null;

/** Tools the browser runs as soon as the model calls them. */
export const CLIENT_TOOL_NAMES = TOOL_DEFS.filter(
  (definition) => definition.runsOn === "client" && !definition.awaitsPerson,
).map((definition) => definition.name);

/** Tools that wait for an approval card, including legacy ones so old chats can still be approved. */
export const APPROVAL_TOOL_NAMES = TOOL_DEFS.filter((definition) => definition.approval === "user").map(
  (definition) => definition.name,
);

/** Tools the model may call on a new turn. Legacy tools stay registered but are not offered. */
export const COACH_ACTIVE_TOOL_NAMES = TOOL_DEFS.filter(
  (definition) => live(definition) && definition.surfaces.includes("coach"),
).map((definition) => definition.name);

/**
 * Live tools, plus any legacy tool this chat already used.
 * A legacy tool has to stay callable so an approval from an older chat can still run,
 * without offering it on a new chat.
 */
export const activeToolNamesFor = (messages: readonly { parts?: readonly { type?: string }[] }[]) => {
  const mentioned = new Set<string>();
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (typeof part.type === "string" && part.type.startsWith("tool-")) {
        mentioned.add(part.type.slice("tool-".length));
      }
    }
  }
  const legacy = TOOL_DEFS.filter((definition) => definition.status === "legacy" && mentioned.has(definition.name)).map(
    (definition) => definition.name,
  );
  return [...COACH_ACTIVE_TOOL_NAMES, ...legacy];
};

/** Server tools a future MCP adapter can expose. Client, ask, and legacy tools are left out. */
export const MCP_TOOL_DEFS = TOOL_DEFS.filter(
  (definition) =>
    live(definition) &&
    definition.runsOn === "server" &&
    definition.category !== "ask" &&
    definition.surfaces.includes("mcp"),
);
