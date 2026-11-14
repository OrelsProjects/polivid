import "server-only";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toolHandlers } from "@/lib/tools/handlers";
import type { ToolContext } from "@/lib/tools/types";
import type { McpPrincipal } from "./auth/principal";
import { splitConfirmToken } from "./canonical";
import { quoteToolCall, redeemQuote } from "./confirm";
import { listMcpTools, MCP_TOOLS, mcpInstructions, needsConfirmation } from "./tool-list";

export const MCP_SERVER_NAME = "polivid";
export const MCP_SERVER_VERSION = "1.0.0";

const toResult = (output: unknown): CallToolResult => {
  const isError =
    Boolean(output) && typeof output === "object" && typeof (output as { error?: unknown }).error === "string";
  const structured =
    output && typeof output === "object" && !Array.isArray(output) ? (output as Record<string, unknown>) : { result: output ?? null };
  return {
    content: [{ type: "text", text: JSON.stringify(output ?? null) }],
    structuredContent: structured,
    ...(isError ? { isError: true } : {}),
  };
};

const errorResult = (message: string): CallToolResult => toResult({ error: message });

const validTimezone = (value: string | null) => {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
};

export interface McpRequestContext {
  principal: McpPrincipal;
  timezone?: string | null;
}

/** Runs one tool call as the principal. Exported for tests and for the route. */
export const callMcpTool = async (name: string, args: unknown, context: McpRequestContext): Promise<CallToolResult> => {
  const definition = MCP_TOOLS.get(name);
  const handler = definition ? toolHandlers[definition.name as keyof typeof toolHandlers] : undefined;
  if (!definition || !handler) return errorResult(`Unknown tool: ${name}`);

  const { input, confirmToken } = splitConfirmToken(args);
  const parsed = definition.inputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
    return errorResult(`Invalid arguments for ${name}: ${issues}`);
  }
  const data = (parsed.data ?? {}) as Record<string, unknown>;
  const userId = context.principal.userId;

  if (needsConfirmation(definition)) {
    if (!confirmToken) return toResult(await quoteToolCall(userId, definition, data));
    const redeemed = await redeemQuote(userId, definition.name, data, confirmToken);
    if (!redeemed.ok) return errorResult(redeemed.error);
  }

  const ctx: ToolContext = {
    userId,
    attachedReferenceKeys: [],
    attachedCharacterId: "",
    attachedMedia: [],
    timezone: validTimezone(context.timezone ?? null),
  };
  try {
    return toResult(await handler(data, ctx));
  } catch (error) {
    console.error(`MCP tool ${name} failed`, error);
    return errorResult(`${definition.title} failed on the server. Try again, or report it if it keeps happening.`);
  }
};

/** A fresh server per request. The transport is stateless, so nothing is shared between calls. */
export const buildMcpServer = (context: McpRequestContext) => {
  const server = new Server(
    { name: MCP_SERVER_NAME, title: "PoliVid", version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: mcpInstructions() },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listMcpTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    callMcpTool(request.params.name, request.params.arguments ?? {}, context),
  );
  return server;
};
