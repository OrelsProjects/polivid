import "server-only";
import { db } from "@/lib/db";
import {
  ACCESS_TTL_MS,
  CODE_TTL_MS,
  isAllowedRedirectUri,
  isPkceChallenge,
  MCP_SCOPE,
  REFRESH_TTL_MS,
  verifyPkce,
} from "./oauth";
import { displayPrefix, hashToken, newToken } from "./tokens";

export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

// ---------- API keys ----------

export const MAX_API_KEYS = 20;

export const createApiKey = async (userId: string, name: string) => {
  const label = name.trim().slice(0, 60) || "Agent key";
  const active = await db.apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_API_KEYS) throw new Error(`You can have up to ${MAX_API_KEYS} keys. Revoke one first.`);
  const key = newToken("apiKey");
  const row = await db.apiKey.create({
    data: { userId, name: label, prefix: displayPrefix(key), hash: hashToken(key) },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });
  return { key, ...row };
};

export const listApiKeys = (userId: string) =>
  db.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });

export const revokeApiKey = async (userId: string, id: string) => {
  const { count } = await db.apiKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count > 0;
};

// ---------- OAuth clients ----------

export const registerClient = async (input: { clientName: unknown; redirectUris: unknown }) => {
  const uris = Array.isArray(input.redirectUris) ? input.redirectUris.filter((uri): uri is string => typeof uri === "string") : [];
  if (uris.length === 0 || uris.length > 10) {
    throw new OAuthError("invalid_redirect_uri", "Register between 1 and 10 redirect_uris.");
  }
  const bad = uris.find((uri) => !isAllowedRedirectUri(uri));
  if (bad) throw new OAuthError("invalid_redirect_uri", `Redirect URI not allowed: ${bad}`);
  const clientName =
    typeof input.clientName === "string" && input.clientName.trim() ? input.clientName.trim().slice(0, 80) : "MCP client";
  const clientId = newToken("client");
  const row = await db.oAuthClient.create({ data: { clientId, clientName, redirectUris: uris } });
  return row;
};

export const findClient = (clientId: string) => db.oAuthClient.findUnique({ where: { clientId } });

// ---------- Codes and tokens ----------

export const issueAuthorizationCode = async (input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  resource?: string;
}) => {
  if (!isPkceChallenge(input.codeChallenge)) throw new OAuthError("invalid_request", "A PKCE S256 code_challenge is required.");
  const code = newToken("code");
  await db.oAuthCode.create({
    data: {
      hash: hashToken(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: MCP_SCOPE,
      resource: input.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
};

const issueTokenPair = async (clientId: string, userId: string, scope: string) => {
  const accessToken = newToken("access");
  const refreshToken = newToken("refresh");
  const now = Date.now();
  await db.oAuthToken.create({
    data: {
      clientId,
      userId,
      scope,
      accessHash: hashToken(accessToken),
      refreshHash: hashToken(refreshToken),
      accessExpiresAt: new Date(now + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
    },
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope,
  };
};

export const exchangeAuthorizationCode = async (input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}) => {
  const hash = hashToken(input.code);
  // Mark the code used in the same statement that checks it, so a replay loses the race.
  const { count } = await db.oAuthCode.updateMany({
    where: { hash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw new OAuthError("invalid_grant", "The code is unknown, expired, or already used.");
  const row = await db.oAuthCode.findUnique({ where: { hash } });
  if (!row || row.clientId !== input.clientId || row.redirectUri !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "The code was issued to a different client or redirect_uri.");
  }
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) {
    throw new OAuthError("invalid_grant", "code_verifier does not match the code_challenge.");
  }
  return issueTokenPair(row.clientId, row.userId, row.scope);
};

export const refreshAccessToken = async (input: { refreshToken: string; clientId: string }) => {
  const hash = hashToken(input.refreshToken);
  const row = await db.oAuthToken.findUnique({ where: { refreshHash: hash } });
  if (!row || row.clientId !== input.clientId) throw new OAuthError("invalid_grant", "Unknown refresh token.");
  if (row.revokedAt) {
    // A rotated token came back: someone may have copied it. End every token this client holds for the person.
    await db.oAuthToken.updateMany({
      where: { userId: row.userId, clientId: row.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new OAuthError("invalid_grant", "This refresh token was already used.");
  }
  if (row.refreshExpiresAt <= new Date()) throw new OAuthError("invalid_grant", "The refresh token expired. Sign in again.");
  const { count } = await db.oAuthToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new OAuthError("invalid_grant", "This refresh token was already used.");
  return issueTokenPair(row.clientId, row.userId, row.scope);
};

/** RFC 7009: revoking an unknown token is not an error. */
export const revokeOAuthToken = async (token: string) => {
  const hash = hashToken(token);
  await db.oAuthToken.updateMany({
    where: { OR: [{ accessHash: hash }, { refreshHash: hash }], revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

// ---------- Connected apps ----------

export const listConnectedApps = async (userId: string) => {
  const rows = await db.oAuthToken.findMany({
    where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    select: { clientId: true, createdAt: true, lastUsedAt: true, client: { select: { clientName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const apps = new Map<string, { clientId: string; name: string; connectedAt: Date; lastUsedAt: Date | null }>();
  for (const row of rows) {
    const known = apps.get(row.clientId);
    if (known) {
      if (row.lastUsedAt && (!known.lastUsedAt || row.lastUsedAt > known.lastUsedAt)) known.lastUsedAt = row.lastUsedAt;
      continue;
    }
    apps.set(row.clientId, {
      clientId: row.clientId,
      name: row.client.clientName,
      connectedAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    });
  }
  return [...apps.values()];
};

export const disconnectApp = async (userId: string, clientId: string) => {
  const { count } = await db.oAuthToken.updateMany({
    where: { userId, clientId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
};
