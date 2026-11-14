import { createHash } from "node:crypto";
import { safeEqual } from "./tokens";

/** The one scope PoliVid grants: use the MCP tools as the person who approved it. */
export const MCP_SCOPE = "mcp";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/;

export const pkceChallengeS256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export const isPkceChallenge = (challenge: string) => CHALLENGE.test(challenge);

/** RFC 7636 S256 check. Plain challenges are not accepted. */
export const verifyPkce = (verifier: string, challenge: string) =>
  VERIFIER.test(verifier) && isPkceChallenge(challenge) && safeEqual(pkceChallengeS256(verifier), challenge);

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:"]);

/**
 * Redirect URIs a public client may register: https anywhere, http only on loopback (desktop clients),
 * or a private-use app scheme such as `cursor://`. Fragments are never allowed.
 */
export const isAllowedRedirectUri = (raw: string) => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
  if (BLOCKED_SCHEMES.has(url.protocol)) return false;
  // Private-use schemes (RFC 8252 7.1) look like `com.example.app:` or `cursor:`.
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol);
};

/**
 * Whether a redirect at authorize time matches a registered one.
 * Exact match, except that a loopback URI may use any port (RFC 8252 7.3).
 */
export const redirectUriMatches = (registered: readonly string[], requested: string) => {
  if (registered.includes(requested)) return true;
  let asked: URL;
  try {
    asked = new URL(requested);
  } catch {
    return false;
  }
  if (asked.protocol !== "http:" || !LOOPBACK.has(asked.hostname)) return false;
  return registered.some((uri) => {
    try {
      const known = new URL(uri);
      return (
        known.protocol === "http:" &&
        known.hostname === asked.hostname &&
        known.pathname === asked.pathname &&
        known.search === asked.search
      );
    } catch {
      return false;
    }
  });
};

export const redirectWith = (uri: string, params: Record<string, string | undefined>) => {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
};
