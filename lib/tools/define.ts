import { videoModeById, type VideoModeId } from "@/lib/video/modes";
import type { ToolDefinition, ToolExample } from "./types";

export const defineTool = (definition: ToolDefinition): ToolDefinition => definition;

/** A Create-mode tool. Title and summary come from the mode list, so the Tools page and the Coach stay in step. */
export const defineModeTool = (input: {
  modeId: VideoModeId;
  name: string;
  whenToUse: string[];
  avoidWhen?: string[];
  inputSchema: ToolDefinition["inputSchema"];
  approvalDetail: (value: Record<string, unknown>) => string;
  examples?: ToolExample[];
}): ToolDefinition => {
  const mode = videoModeById(input.modeId);
  if (!mode) throw new Error(`Unknown video mode ${input.modeId}.`);
  return defineTool({
    name: input.name,
    title: mode.title,
    category: "make",
    summary: mode.description,
    whenToUse: input.whenToUse,
    avoidWhen: input.avoidWhen,
    inputSchema: input.inputSchema,
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    videoMode: input.modeId,
    approvalDetail: input.approvalDetail,
    examples: input.examples,
  });
};
