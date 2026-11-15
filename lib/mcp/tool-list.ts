import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { effectNotes, renderDescription } from "@/lib/tools/describe";
import { MCP_TOOL_DEFS } from "@/lib/tools/registry";
import { mcpAnnotations, toolInputJsonSchema } from "@/lib/tools/to-json-schema";
import { TOOL_CATEGORIES, TOOL_CATEGORY_LABELS, type ToolDefinition } from "@/lib/tools/types";
import { cardToolMeta } from "./apps/card-data";
import { videoCardToolMeta } from "./apps/video-card";
import { CONFIRM_FIELD, CONFIRM_SPEND_TOOL, DECLINE_SPEND_TOOL } from "./canonical";

/** Over MCP every approval tool runs only after a quote is sent back. */
export const needsConfirmation = (definition: ToolDefinition) => definition.approval === "user";

const CONFIRM_DESCRIPTION =
  `Leave this out: the first call returns the price and a token, and nothing runs. After the person agrees, call ${CONFIRM_SPEND_TOOL} with that token instead of repeating this call.`;

const confirmNote = (definition: ToolDefinition) =>
  needsConfirmation(definition)
    ? `\n\nOver MCP this tool runs in two steps. This call returns a quote (credits, balance, ${CONFIRM_FIELD}) and does nothing. Show the person the cost; if they agree, call ${CONFIRM_SPEND_TOOL} with the ${CONFIRM_FIELD}.`
    : "";

/** The second step of every quoted tool. It isn't in the registry because only MCP clients need it. */
const confirmSpendTool = (): Tool => ({
  name: CONFIRM_SPEND_TOOL,
  title: "Confirm and run",
  description:
    `Run a call that was quoted earlier, after the person agreed to the price. Pass only the ${CONFIRM_FIELD} from that quote: ` +
    "the exact priced arguments are stored with it. The token works once, for 10 minutes. A video returns a jobId; poll get_video with it. " +
    "If the token is used or expired you get a fresh quote back; ask the person again before confirming that one. Never call this without the person's agreement.",
  inputSchema: {
    type: "object",
    properties: {
      [CONFIRM_FIELD]: { type: "string", description: "The confirmToken from the quote the person agreed to." },
      via: VIA_PROPERTY,
    },
    required: [CONFIRM_FIELD],
  },
  annotations: { title: "Confirm and run", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  _meta: videoCardToolMeta(),
});

/** The card's buttons call these tools themselves and say so; agents leave it out. */
const VIA_PROPERTY = { type: "string", enum: ["card"], description: "Leave this out. The PoliVid card sets it when the person uses its buttons." };

const declineSpendTool = (): Tool => ({
  name: DECLINE_SPEND_TOOL,
  title: "Decline a quote",
  description:
    `The person said no to a quote. Pass its ${CONFIRM_FIELD}; afterwards it can't be confirmed. Nothing is started or charged. ` +
    "The PoliVid card's Decline button does this too.",
  inputSchema: {
    type: "object",
    properties: {
      [CONFIRM_FIELD]: { type: "string", description: "The confirmToken from the quote the person declined." },
      via: VIA_PROPERTY,
    },
    required: [CONFIRM_FIELD],
  },
  annotations: { title: "Decline a quote", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
});

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
  toolList ??= [
    ...MCP_TOOL_DEFS.map((definition) => ({
    name: definition.name,
    title: definition.title,
    description: renderDescription(definition) + confirmNote(definition),
    inputSchema: jsonSchemaFor(definition),
    annotations: { title: definition.title, ...mcpAnnotations(definition.effects) },
    // Hosts that support MCP Apps show the PoliVid card for video tools.
    ...(cardToolMeta(definition) ? { _meta: cardToolMeta(definition) } : {}),
    })),
    confirmSpendTool(),
    declineSpendTool(),
  ];
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
    `3. Tools that spend credits or can't be undone run in two calls. The first returns a quote and ${CONFIRM_FIELD}. Show the person the cost, and only after they agree, call ${CONFIRM_SPEND_TOOL} with that ${CONFIRM_FIELD} (or ${DECLINE_SPEND_TOOL} if they say no). The PoliVid card also has Approve and Decline buttons; if the person used them, ${CONFIRM_SPEND_TOOL} with the same token reports what happened and never runs twice.`,
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

