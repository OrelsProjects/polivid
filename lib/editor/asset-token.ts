import { createHmac, timingSafeEqual } from "node:crypto";
import type { AssetSource } from "./schema";

export interface AssetTokenPayload {
  userId: string;
  source: AssetSource;
  exp: number;
}

const TOKEN_TTL_MS = 60 * 60 * 1000;

const secret = () => {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is not set.");
  return value;
};

export const signAssetToken = (userId: string, source: AssetSource, ttlMs = TOKEN_TTL_MS) => {
  const payload: AssetTokenPayload = { userId, source, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
};

export const readAssetToken = (token: string): AssetTokenPayload | null => {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  try {
    const expected = createHmac("sha256", secret()).update(body).digest("base64url");
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AssetTokenPayload;
    if (!payload.userId || !payload.source || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

export const publicAppUrl = () => (process.env.APP_PUBLIC_URL?.trim() || "http://localhost:3100").replace(/\/$/, "");
