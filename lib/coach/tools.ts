import "server-only";
import { tool, type ToolSet } from "ai";
import { renderDescription } from "@/lib/tools/describe";
import { toolHandlers } from "@/lib/tools/handlers";
import { TOOL_DEFS, type ToolContext } from "@/lib/tools/registry";

/** AI SDK tools for one Coach turn. Legacy tools stay registered so older chats still validate. */
export const buildCoachTools = (ctx: ToolContext) => {
  const tools: ToolSet = {};
  for (const definition of TOOL_DEFS) {
    if (definition.runsOn === "server") {
      const handler = toolHandlers[definition.name as keyof typeof toolHandlers];
      if (!handler) throw new Error(`Coach tool ${definition.name} has no handler.`);
      tools[definition.name] = tool({
        description: renderDescription(definition),
        inputSchema: definition.inputSchema,
        execute: async (input) => handler(input, ctx),
      });
      continue;
    }
    tools[definition.name] = tool({
      description: renderDescription(definition),
      inputSchema: definition.inputSchema,
    });
  }
  return tools;
};

export type CoachTools = ReturnType<typeof buildCoachTools>;
