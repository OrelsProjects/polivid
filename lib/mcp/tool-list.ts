import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { effectNotes, renderDescription } from "@/lib/tools/describe";
import { MCP_TOOL_DEFS } from "@/lib/tools/registry";
import { mcpAnnotations, toolInputJsonSchema } from "@/lib/tools/to-json-schema";
import { TOOL_CATEGORIES, TOOL_CATEGORY_LABELS, type ToolDefinition } from "@/lib/tools/types";
import { CONFIRM_FIELD } from "./canonical";

/** Over MCP every approval tool runs only after a quote is sent back. */
export const needsConfirmation = (definition: ToolDefinition) => definition.approval === "user";

const CONFIRM_DESCRIPTION =
  "Leave this out on the first call: you get back the price and a token, and nothing runs. " +
  "After the person agrees, call again with the same arguments plus this token.";

const confirmNote = (definition: ToolDefinition) =>
  needsConfirmation(definition)
    ? `\n\nOver MCP this tool runs in two calls. The first call returns a quote (credits, balance, ${CONFIRM_FIELD}) and does nothing. Show the person the cost, then repeat the call with ${CONFIRM_FIELD}.`
    : "";

const jsonSchemaFor = (definition: ToolDefinition): Tool["inputSchema"] => {
  const schema = { ...(toolInputJsonSchema(definition.inputSchema) as Record<string, unknown>) };
  delete schema.$schema;
  const properties = { ...((schema.properties as Record<string, unknown> | undefined) ?? {}) };
  if (needsConfirmation(definition)) properties[CONFIRM_FIELD] = { type: "string", description: CONFIRM_DESCRIPTION };
  return { ...schema, type: "object", properties } as Tool["inputSchema"];
};

/** Built once per process: the registry does not change at runtime. */
let toolList: Tool[] | null = null;
export const listMcpTools = () => {
  toolList ??= MCP_TOOL_DEFS.map((definition) => ({
    name: definition.name,
    title: definition.title,
    description: renderDescription(definition) + confirmNote(definition),
    inputSchema: jsonSchemaFor(definition),
    annotations: { title: definition.title, ...mcpAnnotations(definition.effects) },
  }));
  return toolList;
};

export const MCP_TOOLS = new Map(MCP_TOOL_DEFS.map((definition) => [definition.name, definition]));

export const mcpInstructions = () => {
  const lines = [
    "PoliVid makes and edits short videos. Every capability of the app is a tool here; the person's account and credits are used.",
    "",
    "Workflow:",
    "1. Discover first: list_modes, list_models, list_templates, list_voices, list_characters, list_presets, list_uploads, list_songs. Don't guess ids.",
    "2. Plan when it helps: make_storyboard or plan_shots, then pass the scene seconds on as cuts. estimate_credits prices any idea for free.",
    `3. Tools that spend credits or can't be undone run in two calls. The first returns a quote and ${CONFIRM_FIELD}. Show the person the cost, and only after they agree, repeat the exact call with ${CONFIRM_FIELD}.`,
    "4. Videos and productions run in the background. Poll get_video or get_production until the status is ready, failed, or waiting for input.",
    "5. When a video is ready, open_in_editor gives a projectId. Every edit_* tool changes that timeline for free, and edit_read_timeline shows it.",
    "6. To attach your own picture, audio or video, import it with import_media_from_url (when listed) and pass the key it returns.",
    "",
    "Tools:",
  ];
  for (const category of TOOL_CATEGORIES) {
    const tools = MCP_TOOL_DEFS.filter((definition) => definition.category === category);
    if (tools.length === 0) continue;
    lines.push(`${TOOL_CATEGORY_LABELS[category]}:`);
    for (const definition of tools) lines.push(`- ${definition.name}: ${definition.summary} ${effectNotes(definition)}`);
  }
  return lines.join("\n");
};

