import { CLIENT_TOOL_NAMES } from "@/lib/tools/registry";

/** Tools the browser runs as soon as the model calls them. Everything else executes on the server or waits for the person. */
export const COACH_CLIENT_TOOL_NAMES = CLIENT_TOOL_NAMES;

export type CoachClientToolName = (typeof CLIENT_TOOL_NAMES)[number];

export const isCoachClientTool = (toolName: string): toolName is CoachClientToolName =>
  (CLIENT_TOOL_NAMES as readonly string[]).includes(toolName);
