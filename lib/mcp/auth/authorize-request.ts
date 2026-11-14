import "server-only";
import { isPkceChallenge, MCP_SCOPE, redirectUriMatches, redirectWith } from "./oauth";
import { findClient } from "./store";

export type AuthorizeParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export type AuthorizeCheck =
  /** Client or redirect is wrong: show the error, never redirect to an unverified URI. */
  | { kind: "fatal"; message: string }
  /** Client and redirect are fine, but the request isn't: send the error back to the client. */
  | { kind: "redirect"; url: string }
  | {
      kind: "ok";
      clientId: string;
      clientName: string;
      redirectUri: string;
      codeChallenge: string;
      state?: string;
      resource?: string;
    };

/** Validates an /oauth/authorize request the same way for the page and for the approve action. */
export const checkAuthorizeRequest = async (params: AuthorizeParams): Promise<AuthorizeCheck> => {
  const clientId = one(params.client_id);
  const redirectUri = one(params.redirect_uri);
  if (!clientId) return { kind: "fatal", message: "This link is missing client_id." };
  const client = await findClient(clientId);
  if (!client) return { kind: "fatal", message: "This app is not registered with PoliVid. Ask it to connect again." };
  if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
    return { kind: "fatal", message: "The app sent a redirect address it did not register." };
  }
  const state = one(params.state) || undefined;
  const fail = (error: string, description: string) => ({
    kind: "redirect" as const,
    url: redirectWith(redirectUri, { error, error_description: description, state }),
  });
  if (one(params.response_type) !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  const codeChallenge = one(params.code_challenge);
  if (one(params.code_challenge_method) !== "S256" || !isPkceChallenge(codeChallenge)) {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const scope = one(params.scope);
  if (scope && !scope.split(/\s+/).every((item) => item === MCP_SCOPE)) {
    return fail("invalid_scope", `The only scope is "${MCP_SCOPE}".`);
  }
  return {
    kind: "ok",
    clientId,
    clientName: client.clientName,
    redirectUri,
    codeChallenge,
    state,
    resource: one(params.resource) || undefined,
  };
};
