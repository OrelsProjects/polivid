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
import type { ToolContext, ToolDefinition } from "@/lib/tools/types";
import type { McpPrincipal } from "./auth/principal";
import { CONFIRM_FIELD, DECLINE_SPEND_TOOL, splitConfirmToken } from "./canonical";
import {
  claimQuoteByHash,
  CONFIRM_SPEND_TOOL,
  declineQuoteByHash,
  quoteToolCall,
  recordQuoteOutcome,
  redeemQuote,
  settledQuoteMessage,
  type QuoteOutcome,
  type QuoteVia,
} from "./confirm";
import { hashToken } from "./auth/tokens";
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
  if (name === CONFIRM_SPEND_TOOL) return confirmSpend(args, context);
  if (name === DECLINE_SPEND_TOOL) return declineSpend(args, context);
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
  const run = runOptions(context);

  if (needsConfirmation(definition)) {
    if (!confirmToken) return toResult(await quoteToolCall(userId, definition, data));
    const redeemed = await redeemQuote(userId, definition.name, data, confirmToken);
    if (!redeemed.ok) {
      if (redeemed.settled) return settledResult(redeemed.settled, run);
      // A stale, used, or mismatched token gets a fresh quote in the same reply, so the agent
      // never loops on an old token. Nothing has run; the person still has to agree.
      const fresh = await quoteToolCall(userId, definition, data);
      return toResult({
        ...fresh,
        tokenProblem: redeemed.reason,
        next: `${redeemed.reason} Nothing was started or charged. Use only this new confirmToken, never an earlier one. ${fresh.next}`,
      });
    }
    const result = await runTool(definition, data, run);
    await recordQuoteOutcome(hashToken(confirmToken), approvedOutcome(result, "agent"));
    return result;
  }
  return runTool(definition, data, run);
};

interface RunOptions {
  userId: string;
  timezone?: string;
  origin?: string;
}

const runOptions = (context: McpRequestContext): RunOptions => ({
  userId: context.principal.userId,
  timezone: context.timezone ?? undefined,
  origin: context.origin,
});

/** Runs a validated (and, if needed, confirmed) call, adding the video card data for video tools. */
const runTool = async (definition: ToolDefinition, data: Record<string, unknown>, run: RunOptions) => {
  const handler = toolHandlers[definition.name as keyof typeof toolHandlers];
  const { userId } = run;
  const ctx: ToolContext = {
    userId,
    attachedReferenceKeys: [],
    attachedCharacterId: "",
    attachedMedia: [],
    timezone: validTimezone(run.timezone ?? null),
  };
  try {
    const output = await handler(data, ctx);
    if (!hasVideoCard(definition)) return toResult(output);
    const origin = run.origin ?? publicOrigin();
    return toResult(
      withVideoCard(output, origin, (videoId) => {
        const token = signAssetToken(userId, { type: "video", videoId }, PLAYBACK_LINK_MS);
        return `${origin}/api/editor/assets/${encodeURIComponent(token)}`;
      }),
    );
  } catch (error) {
    console.error(`MCP tool ${definition.name} failed`, error);
    return errorResult(`${definition.title} failed on the server. Try again, or report it if it keeps happening.`);
  }
};

/** The job a confirmed call started, read from its result. */
const startedJobId = (result: CallToolResult) => {
  const data = (result.structuredContent ?? {}) as { jobId?: unknown; card?: { videoId?: unknown } };
  const id = typeof data.jobId === "string" ? data.jobId : typeof data.card?.videoId === "string" ? data.card.videoId : "";
  return id || undefined;
};

const approvedOutcome = (result: CallToolResult, via: QuoteVia): QuoteOutcome => {
  const jobId = startedJobId(result);
  return { kind: "approved", via, ...(jobId ? { jobId } : {}) };
};

/**
 * A quote that was already approved or declined. An approved video comes back as its live status,
 * so the card shows progress and the agent knows the job id. Nothing runs again.
 */
const settledResult = async (outcome: QuoteOutcome, run: RunOptions) => {
  const next = settledQuoteMessage(outcome);
  const getVideo = MCP_TOOLS.get("get_video");
  if (outcome.kind === "approved" && outcome.jobId && getVideo) {
    const status = await runTool(getVideo, { videoId: outcome.jobId }, run);
    const data = (status.structuredContent ?? {}) as Record<string, unknown>;
    if (!status.isError) return toResult({ ...data, alreadyApproved: true, jobId: outcome.jobId, next });
  }
  return toResult({ settled: outcome.kind, ...(outcome.kind === "approved" && outcome.jobId ? { jobId: outcome.jobId } : {}), next });
};

const tokenFrom = (args: unknown) =>
  args && typeof args === "object" ? String((args as Record<string, unknown>)[CONFIRM_FIELD] ?? "").trim() : "";

const viaFrom = (args: unknown): QuoteVia =>
  args && typeof args === "object" && (args as Record<string, unknown>).via === "card" ? "card" : "agent";

/**
 * Runs a quote the person agreed to, by its token hash. Used by confirm_spend (agent or card) and
 * by the approval page. The arguments come from the quote, so nothing is repeated, and a quote
 * that was already settled reports what happened instead of running twice.
 */
export const runQuote = async (tokenHash: string, run: RunOptions, via: QuoteVia): Promise<CallToolResult> => {
  const claimed = await claimQuoteByHash(run.userId, tokenHash);
  if (!claimed.ok) {
    if (claimed.settled) return settledResult(claimed.settled, run);
    const definition = claimed.toolName ? MCP_TOOLS.get(claimed.toolName) : undefined;
    const input = claimed.input && typeof claimed.input === "object" && !Array.isArray(claimed.input) ? (claimed.input as Record<string, unknown>) : null;
    if (definition && input && via !== "page") {
      const fresh = await quoteToolCall(run.userId, definition, input);
      return toResult({
        ...fresh,
        tokenProblem: claimed.reason,
        next: `${claimed.reason} Nothing was started or charged. ${fresh.next}`,
      });
    }
    return errorResult(`${claimed.reason} Nothing was started. Ask for a new quote.`);
  }
  const definition = MCP_TOOLS.get(claimed.toolName);
  if (!definition) return errorResult("That quote is for a tool that no longer exists.");
  const parsed = definition.inputSchema.safeParse(claimed.input);
  if (!parsed.success) return errorResult("The quoted arguments are no longer valid. Ask for a new quote.");
  const result = await runTool(definition, (parsed.data ?? {}) as Record<string, unknown>, run);
  if (!result.isError) await recordQuoteOutcome(tokenHash, approvedOutcome(result, via));
  return result;
};

/** confirm_spend: runs a quoted call from its token alone (some clients block repeated calls as duplicates). */
const confirmSpend = async (args: unknown, context: McpRequestContext): Promise<CallToolResult> => {
  const token = tokenFrom(args);
  if (!token) return errorResult(`Pass the ${CONFIRM_FIELD} from the quote.`);
  return runQuote(hashToken(token), runOptions(context), viaFrom(args));
};

/** decline_spend: the person said no. The quote can't be confirmed afterwards. */
const declineSpend = async (args: unknown, context: McpRequestContext): Promise<CallToolResult> => {
  const token = tokenFrom(args);
  if (!token) return errorResult(`Pass the ${CONFIRM_FIELD} from the quote.`);
  const declined = await declineQuoteByHash(context.principal.userId, hashToken(token), viaFrom(args));
  if (!declined.ok) return toResult({ declined: false, next: declined.reason });
  return toResult({ declined: true, next: "Declined. Nothing was started or charged. Don't run it unless the person asks again." });
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
