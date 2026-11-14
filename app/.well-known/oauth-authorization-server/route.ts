import { MCP_SCOPE } from "@/lib/mcp/auth/oauth";
import { corsPreflight, publicOrigin, withCors } from "@/lib/mcp/origin";

/** RFC 8414 authorization server metadata. Public clients only: PKCE S256, no client secret. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  return withCors(
    Response.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      revocation_endpoint: `${origin}/api/oauth/revoke`,
      scopes_supported: [MCP_SCOPE],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      service_documentation: `${origin}/settings/connect`,
    }),
  );
}

export const OPTIONS = () => corsPreflight();
