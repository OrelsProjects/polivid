/**
 * The public origin agents use. It names the OAuth issuer and the MCP resource, so it must be stable:
 * set APP_PUBLIC_URL in production. Locally it falls back to the request's own origin.
 */
export const publicOrigin = (request?: Request) => {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) {
    // Only the scheme and host count, so a value like https://example.com/api/mcp still works.
    try {
      return new URL(configured).origin;
    } catch {
      // Not a URL: fall through to the request's origin.
    }
  }
  if (request) return new URL(request.url).origin;
  return "http://localhost:3100";
};

export const MCP_PATH = "/api/mcp";

export const mcpResourceUrl = (request?: Request) => `${publicOrigin(request)}${MCP_PATH}`;

export const protectedResourceMetadataUrl = (request?: Request) =>
  `${publicOrigin(request)}/.well-known/oauth-protected-resource${MCP_PATH}`;

/** CORS for the endpoints MCP clients call from a browser (inspector, web connectors). */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID, X-Timezone",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

export const withCors = (response: Response) => {
  for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
  return response;
};

export const corsPreflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });
