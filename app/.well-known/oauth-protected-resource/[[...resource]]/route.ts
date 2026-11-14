import { MCP_SCOPE } from "@/lib/mcp/auth/oauth";
import { corsPreflight, mcpResourceUrl, publicOrigin, withCors } from "@/lib/mcp/origin";

/** RFC 9728 protected resource metadata for /api/mcp. Served at the root and at the path-suffixed URL. */
export async function GET(request: Request) {
  return withCors(
    Response.json({
      resource: mcpResourceUrl(request),
      authorization_servers: [publicOrigin(request)],
      scopes_supported: [MCP_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "PoliVid",
      resource_documentation: `${publicOrigin(request)}/settings/connect`,
    }),
  );
}

export const OPTIONS = () => corsPreflight();
