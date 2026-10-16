/** Tools the browser runs. Everything else executes on the server. */
export const COACH_CLIENT_TOOL_NAMES = ["app_open_create", "app_open_video", "app_open_production"] as const;

export type CoachClientToolName = (typeof COACH_CLIENT_TOOL_NAMES)[number];

export const isCoachClientTool = (toolName: string): toolName is CoachClientToolName =>
  (COACH_CLIENT_TOOL_NAMES as readonly string[]).includes(toolName);
