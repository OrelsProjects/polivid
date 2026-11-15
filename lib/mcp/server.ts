import "server-only";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { signAssetToken } from "@/lib/editor/asset-token";
import { toolHandlers } from "@/lib/tools/handlers";
import type { ToolContext } from "@/lib/tools/types";
import type { McpPrincipal } from "./auth/principal";
import { splitConfirmToken } from "./canonical";
import { quoteToolCall, redeemQuote } from "./confirm";
import { listMcpTools, MCP_TOOLS, mcpInstructions, needsConfirmation } from "./tool-list";
import { hasVideoCard, withVideoCard } from "./apps/card-data";
import { MCP_APP_MIME_TYPE, VIDEO_CARD_URI, videoCardHtml, videoCardResourceMeta } from "./apps/video-card";
import { publicOrigin } from "./origin";

/** Playback links in the card last long enough to watch, not long enough to pass around. */
const PLAYBACK_LINK_MS = 2 * 60 * 60 * 1000;

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
  /** Public origin the card links and plays from. Defaults to APP_PUBLIC_URL. */
  origin?: string;
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
    if (!redeemed.ok) {
      // A stale, used, or mismatched token gets a fresh quote in the same reply, so the agent
      // never loops on an old token. Nothing has run; the person still has to agree.
      const fresh = await quoteToolCall(userId, definition, data);
      return toResult({
        ...fresh,
        tokenProblem: redeemed.reason,
        next: `${redeemed.reason} Nothing was started or charged. Use only this new confirmToken, never an earlier one. ${fresh.next}`,
      });
    }
  }

  const ctx: ToolContext = {
    userId,
    attachedReferenceKeys: [],
    attachedCharacterId: "",
    attachedMedia: [],
    timezone: validTimezone(context.timezone ?? null),
  };
  try {
    const output = await handler(data, ctx);
    if (!hasVideoCard(definition)) return toResult(output);
    const origin = context.origin ?? publicOrigin();
    return toResult(
      withVideoCard(output, origin, (videoId) => {
        const token = signAssetToken(userId, { type: "video", videoId }, PLAYBACK_LINK_MS);
        return `${origin}/api/editor/assets/${encodeURIComponent(token)}`;
      }),
    );
  } catch (error) {
    console.error(`MCP tool ${name} failed`, error);
    return errorResult(`${definition.title} failed on the server. Try again, or report it if it keeps happening.`);
  }
};

/** A fresh server per request. The transport is stateless, so nothing is shared between calls. */
export const buildMcpServer = (context: McpRequestContext) => {
  const server = new Server(
    { name: MCP_SERVER_NAME, title: "PoliVid", version: MCP_SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} }, instructions: mcpInstructions() },
  );
  const origin = context.origin ?? publicOrigin();
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listMcpTools() }));
  // The PoliVid card (MCP Apps). Hosts without MCP Apps support never read it; tools still return text.
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: VIDEO_CARD_URI,
        name: "PoliVid video card",
        description: "Shows a PoliVid video being made, then plays it.",
        mimeType: MCP_APP_MIME_TYPE,
        _meta: videoCardResourceMeta(origin),
      },
    ],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== VIDEO_CARD_URI) throw new Error(`Unknown resource: ${request.params.uri}`);
    return {
      contents: [
        { uri: VIDEO_CARD_URI, mimeType: MCP_APP_MIME_TYPE, text: videoCardHtml(origin), _meta: videoCardResourceMeta(origin) },
      ],
    };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    callMcpTool(request.params.name, request.params.arguments ?? {}, context),
  );
  return server;
};
