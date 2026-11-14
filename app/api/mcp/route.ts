import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveBearer } from "@/lib/mcp/auth/principal";
import { corsPreflight, protectedResourceMetadataUrl, withCors } from "@/lib/mcp/origin";
import { buildMcpServer } from "@/lib/mcp/server";

/** Video tools can wait on a model, so give them the same budget as the Coach. */
export const maxDuration = 300;

const unauthorized = (request: Request, reason?: string) =>
  withCors(
    Response.json(
      { error: reason ?? "Send a PoliVid API key or OAuth access token as a Bearer token." },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl(request)}"${
            reason ? `, error="invalid_token", error_description="${reason}"` : ""
          }`,
        },
      },
    ),
  );

/**
 * Streamable HTTP MCP endpoint, stateless: each request gets its own server and transport,
 * so it works on serverless hosts with no session store.
 */
const handle = async (request: Request) => {
  const hasToken = Boolean(request.headers.get("authorization"));
  const principal = await resolveBearer(request);
  if (!principal) return unauthorized(request, hasToken ? "The token is invalid, expired, or revoked." : undefined);

  const server = buildMcpServer({ principal, timezone: request.headers.get("x-timezone") });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    // JSON responses are complete once handleRequest resolves.
    void server.close();
  }
};

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = () => corsPreflight();
