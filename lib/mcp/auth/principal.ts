import "server-only";
import { db } from "@/lib/db";
import { bearerFrom, hashToken, tokenKind } from "./tokens";

export interface McpPrincipal {
  userId: string;
  via: "api_key" | "oauth";
  /** ApiKey id or OAuthToken id. */
  credentialId: string;
}

/** Write lastUsedAt at most this often per credential. */
const TOUCH_EVERY_MS = 60_000;

const stale = (at: Date | null) => !at || Date.now() - at.getTime() > TOUCH_EVERY_MS;

/** Who an MCP request runs as, from its Bearer token. Null means 401. The user id never comes from the request body. */
export const resolveBearer = async (request: Request): Promise<McpPrincipal | null> => {
  const token = bearerFrom(request.headers.get("authorization"));
  if (!token) return null;
  const kind = tokenKind(token);
  const hash = hashToken(token);

  if (kind === "apiKey") {
    const key = await db.apiKey.findUnique({ where: { hash }, select: { id: true, userId: true, revokedAt: true, lastUsedAt: true } });
    if (!key || key.revokedAt) return null;
    if (stale(key.lastUsedAt)) {
      await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    return { userId: key.userId, via: "api_key", credentialId: key.id };
  }

  if (kind === "access") {
    const row = await db.oAuthToken.findUnique({
      where: { accessHash: hash },
      select: { id: true, userId: true, revokedAt: true, accessExpiresAt: true, lastUsedAt: true },
    });
    if (!row || row.revokedAt || row.accessExpiresAt <= new Date()) return null;
    if (stale(row.lastUsedAt)) {
      await db.oAuthToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    return { userId: row.userId, via: "oauth", credentialId: row.id };
  }

  return null;
};
