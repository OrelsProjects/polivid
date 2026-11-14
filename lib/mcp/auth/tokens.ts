import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Every secret PoliVid hands to an agent starts with one of these, so a leaked string is easy to recognise. */
export const TOKEN_PREFIX = {
  apiKey: "pv_live_",
  access: "pvat_",
  refresh: "pvrt_",
  code: "pvc_",
  client: "pvcl_",
  quote: "pvq_",
} as const;

export type TokenKind = keyof typeof TOKEN_PREFIX;

/** 32 random bytes after the prefix. */
export const newToken = (kind: TokenKind) => `${TOKEN_PREFIX[kind]}${randomBytes(32).toString("base64url")}`;

/** Only this hash is stored. A database leak does not leak usable tokens. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const tokenKind = (token: string): TokenKind | null => {
  for (const [kind, prefix] of Object.entries(TOKEN_PREFIX) as [TokenKind, string][]) {
    if (token.startsWith(prefix)) return kind;
  }
  return null;
};

/** The part of an API key the settings page shows, e.g. `pv_live_Ab12Cd`. */
export const displayPrefix = (key: string) => key.slice(0, TOKEN_PREFIX.apiKey.length + 6);

export const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** The bearer token from an Authorization header, or null. */
export const bearerFrom = (header: string | null) => {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
};
