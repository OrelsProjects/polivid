import { oauthError } from "@/lib/mcp/auth/form";
import { MCP_SCOPE } from "@/lib/mcp/auth/oauth";
import { OAuthError, registerClient } from "@/lib/mcp/auth/store";
import { corsPreflight, withCors } from "@/lib/mcp/origin";
import { rateLimited } from "@/lib/mcp/rate-limit";

/** RFC 7591 dynamic client registration. Anyone may register; nothing is granted until a person approves. */
export async function POST(request: Request) {
  if (rateLimited(`register:${request.headers.get("x-forwarded-for") ?? "local"}`, 20, 60 * 60 * 1000)) {
    return withCors(oauthError("too_many_requests", "Too many registrations. Try again later.", 429));
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return withCors(oauthError("invalid_client_metadata", "Send client metadata as JSON."));
  const method = body.token_endpoint_auth_method;
  if (method !== undefined && method !== "none") {
    return withCors(oauthError("invalid_client_metadata", "Only public clients are supported (token_endpoint_auth_method none)."));
  }
  try {
    const client = await registerClient({ clientName: body.client_name, redirectUris: body.redirect_uris });
    return withCors(
      Response.json(
        {
          client_id: client.clientId,
          client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
          client_name: client.clientName,
          redirect_uris: client.redirectUris,
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: MCP_SCOPE,
        },
        { status: 201 },
      ),
    );
  } catch (error) {
    if (error instanceof OAuthError) return withCors(oauthError(error.code, error.message, error.status));
    throw error;
  }
}

export const OPTIONS = () => corsPreflight();
