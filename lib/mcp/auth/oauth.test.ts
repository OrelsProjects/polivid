import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedRedirectUri, pkceChallengeS256, redirectUriMatches, redirectWith, verifyPkce } from "./oauth";
import { bearerFrom, displayPrefix, hashToken, newToken, tokenKind } from "./tokens";

// RFC 7636 appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

test("PKCE S256 matches the RFC 7636 example", () => {
  assert.equal(pkceChallengeS256(VERIFIER), CHALLENGE);
  assert.equal(verifyPkce(VERIFIER, CHALLENGE), true);
});

test("PKCE rejects a wrong or malformed verifier", () => {
  assert.equal(verifyPkce(`${VERIFIER.slice(0, -1)}A`, CHALLENGE), false);
  assert.equal(verifyPkce("short", pkceChallengeS256("short")), false);
  assert.equal(verifyPkce(VERIFIER, "plain-challenge"), false);
});

test("redirect URIs: https, loopback http, and app schemes only", () => {
  assert.equal(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(isAllowedRedirectUri("http://localhost:6274/oauth/callback"), true);
  assert.equal(isAllowedRedirectUri("http://127.0.0.1:33418/callback"), true);
  assert.equal(isAllowedRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback"), true);
  assert.equal(isAllowedRedirectUri("http://evil.example/callback"), false);
  assert.equal(isAllowedRedirectUri("javascript:alert(1)"), false);
  assert.equal(isAllowedRedirectUri("data:text/html,hi"), false);
  assert.equal(isAllowedRedirectUri("https://claude.ai/cb#frag"), false);
  assert.equal(isAllowedRedirectUri("not a url"), false);
});

test("redirect match is exact, except loopback ports", () => {
  const registered = ["https://claude.ai/cb", "http://127.0.0.1:5000/callback"];
  assert.equal(redirectUriMatches(registered, "https://claude.ai/cb"), true);
  assert.equal(redirectUriMatches(registered, "https://claude.ai/cb2"), false);
  assert.equal(redirectUriMatches(registered, "http://127.0.0.1:61234/callback"), true);
  assert.equal(redirectUriMatches(registered, "http://127.0.0.1:61234/other"), false);
  assert.equal(redirectUriMatches(registered, "http://localhost:5000/callback"), false);
});

test("redirectWith keeps existing query and skips undefined", () => {
  const url = new URL(redirectWith("https://a.example/cb?x=1", { code: "abc", state: undefined }));
  assert.equal(url.searchParams.get("x"), "1");
  assert.equal(url.searchParams.get("code"), "abc");
  assert.equal(url.searchParams.has("state"), false);
});

test("tokens carry their kind and hash stably", () => {
  const key = newToken("apiKey");
  assert.equal(tokenKind(key), "apiKey");
  assert.equal(tokenKind(newToken("access")), "access");
  assert.equal(tokenKind("random"), null);
  assert.equal(hashToken(key), hashToken(key));
  assert.notEqual(hashToken(key), hashToken(newToken("apiKey")));
  assert.equal(displayPrefix(key).length, "pv_live_".length + 6);
  assert.notEqual(newToken("apiKey"), key);
});

test("bearerFrom reads the Authorization header", () => {
  assert.equal(bearerFrom("Bearer abc.def"), "abc.def");
  assert.equal(bearerFrom("bearer   xyz "), "xyz");
  assert.equal(bearerFrom("Basic abc"), null);
  assert.equal(bearerFrom(null), null);
});
