import "server-only";
import { tool, type ToolSet } from "ai";
import { blocksChangeWhileFilming, FILMING_CHANGE_REPLY } from "@/lib/coach/filming-guard";
import { HELD_IMAGE_TOOLS, imageToolBlockedByLook, LOOK_CONFIRM_ERROR } from "@/lib/coach/preset-confirm";
import { renderDescription } from "@/lib/tools/describe";
import { toolHandlers } from "@/lib/tools/handlers";
import { TOOL_DEFS, type ToolContext } from "@/lib/tools/registry";

/** AI SDK tools for one Coach turn. Legacy tools stay registered so older chats still validate. */
export const buildCoachTools = (ctx: ToolContext) => {
  const look = { suggested: false };
  const tools: ToolSet = {};
  for (const definition of TOOL_DEFS) {
    if (definition.runsOn === "server") {
      const handler = toolHandlers[definition.name as keyof typeof toolHandlers];
      if (!handler) throw new Error(`Coach tool ${definition.name} has no handler.`);
      tools[definition.name] = tool({
        description: renderDescription(definition),
        inputSchema: definition.inputSchema,
        execute: async (input) => {
          if (ctx.filming && blocksChangeWhileFilming(definition)) {
            return {
              error: `${FILMING_CHANGE_REPLY} Tell the person that in one sentence. Do not call another change tool.`,
            };
          }
          if (definition.name === "suggest_preset" && !ctx.runWild) look.suggested = true;
          if ((HELD_IMAGE_TOOLS as readonly string[]).includes(definition.name)) {
            // Yield once so a sibling suggest_preset can mark the look before pictures start.
            await Promise.resolve();
            if (imageToolBlockedByLook(definition.name, look.suggested)) return { error: LOOK_CONFIRM_ERROR };
          }
          return handler(input, ctx);
        },
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
