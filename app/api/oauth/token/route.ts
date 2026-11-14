import { oauthError, readParams } from "@/lib/mcp/auth/form";
import { exchangeAuthorizationCode, OAuthError, refreshAccessToken } from "@/lib/mcp/auth/store";
import { corsPreflight, withCors } from "@/lib/mcp/origin";

export async function POST(request: Request) {
  const params = await readParams(request);
  const clientId = params.client_id ?? "";
  if (!clientId) return withCors(oauthError("invalid_client", "client_id is required.", 401));
  try {
    if (params.grant_type === "authorization_code") {
      if (!params.code || !params.redirect_uri || !params.code_verifier) {
        return withCors(oauthError("invalid_request", "code, redirect_uri and code_verifier are required."));
      }
      const tokens = await exchangeAuthorizationCode({
        code: params.code,
        clientId,
        redirectUri: params.redirect_uri,
        codeVerifier: params.code_verifier,
      });
      return withCors(Response.json(tokens, { headers: { "Cache-Control": "no-store" } }));
    }
    if (params.grant_type === "refresh_token") {
      if (!params.refresh_token) return withCors(oauthError("invalid_request", "refresh_token is required."));
      const tokens = await refreshAccessToken({ refreshToken: params.refresh_token, clientId });
      return withCors(Response.json(tokens, { headers: { "Cache-Control": "no-store" } }));
    }
    return withCors(oauthError("unsupported_grant_type", "Use authorization_code or refresh_token."));
  } catch (error) {
    if (error instanceof OAuthError) return withCors(oauthError(error.code, error.message, error.status));
    throw error;
  }
}

export const OPTIONS = () => corsPreflight();
