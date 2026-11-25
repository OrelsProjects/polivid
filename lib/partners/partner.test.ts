import assert from "node:assert/strict";
import test from "node:test";
import { checkPartnerSignature, MAX_SKEW_SECONDS, signPartnerRequest, signPartnerWebhook } from "./signature";
import { createBodyFor, PartnerVideoSchema } from "./video-request";

const SECRET = "pvp_test-secret";
const NOW = 1_800_000_000;
const BODY = JSON.stringify({ kind: "ugc" });

test("a request signed with the partner secret, for that user and body, passes", () => {
  const signature = signPartnerRequest(SECRET, String(NOW), "user-1", BODY);
  assert.equal(checkPartnerSignature({ secret: SECRET, timestamp: String(NOW), signature, externalUserId: "user-1", rawBody: BODY, nowSeconds: NOW }), null);
});

test("a changed body, another user, an old timestamp, or another secret is refused", () => {
  const signature = signPartnerRequest(SECRET, String(NOW), "user-1", BODY);
  const base = { secret: SECRET, timestamp: String(NOW), signature, externalUserId: "user-1", rawBody: BODY, nowSeconds: NOW };
  assert.equal(checkPartnerSignature({ ...base, rawBody: BODY.replace("ugc", "avatar") }), "mismatch");
  assert.equal(checkPartnerSignature({ ...base, externalUserId: "user-2" }), "mismatch");
  assert.equal(checkPartnerSignature({ ...base, secret: "pvp_other" }), "mismatch");
  assert.equal(checkPartnerSignature({ ...base, nowSeconds: NOW + MAX_SKEW_SECONDS + 1 }), "stale");
  assert.equal(checkPartnerSignature({ ...base, signature: null }), "missing");
});

test("webhook signatures cover the timestamp and body", () => {
  assert.notEqual(signPartnerWebhook("whsec", "1", "{}"), signPartnerWebhook("whsec", "2", "{}"));
  assert.match(signPartnerWebhook("whsec", "1", "{}"), /^[0-9a-f]{64}$/);
});

const CHARACTER = "00000000-0000-4000-8000-000000000001";

test("each kind of video maps to its own social tool and nothing else", () => {
  const ugc = createBodyFor(PartnerVideoSchema.parse({ kind: "ugc", characterId: CHARACTER, script: "Try this today.", productKey: "uploads/u/p.png" }));
  assert.equal(ugc.mode, "ugc");
  assert.equal(ugc.mediaKey, "uploads/u/p.png");
  assert.equal(ugc.format, "9:16");
  assert.equal(createBodyFor(PartnerVideoSchema.parse({ kind: "avatar", photoKey: "uploads/u/me.png", script: "Hello there." })).mode, "avatar");
  assert.equal(createBodyFor(PartnerVideoSchema.parse({ kind: "captions", videoKey: "uploads/u/v.mp4" })).mode, "captions");
  const faceless = createBodyFor(PartnerVideoSchema.parse({ kind: "faceless", script: "One line. Another line. A third line." }));
  assert.deepEqual([faceless.mode, faceless.media, faceless.verbatim, faceless.characterId], ["voiceover", "stills", true, "studio"]);
});

test("a skit is the character acting out the script, read word for word, with no captions drawn by the model", () => {
  const skit = createBodyFor(
    PartnerVideoSchema.parse({ kind: "skit", characterId: CHARACTER, script: "[Quill slips] I never saw it coming.", tier: "low", direction: "Bouncy." }),
  );
  assert.deepEqual(
    [skit.mode, skit.verbatim, skit.characterId, skit.tier, skit.format, skit.showText, skit.visualDirection, skit.prompt],
    ["skit", true, CHARACTER, "low", "9:16", false, "Bouncy.", "[Quill slips] I never saw it coming."],
  );
  assert.equal(PartnerVideoSchema.safeParse({ kind: "skit", script: "No character to act it." }).success, false);
  assert.equal(PartnerVideoSchema.safeParse({ kind: "skit", characterId: CHARACTER, script: "Hi there.", model: "kling-4" }).success, false);
  assert.equal(PartnerVideoSchema.safeParse({ kind: "skit", characterId: CHARACTER, script: "Hi there.", productKey: "uploads/u/p.png" }).success, false);
  assert.equal(
    PartnerVideoSchema.safeParse({ kind: "skit", characterId: CHARACTER, script: "Hi there.", finish: { captions: "comic" } }).success,
    true,
  );
});

test("unknown kinds and unknown fields are refused, not ignored", () => {
  assert.equal(PartnerVideoSchema.safeParse({ kind: "music", script: "x" }).success, false);
  assert.equal(PartnerVideoSchema.safeParse({ kind: "ugc", characterId: CHARACTER, script: "Hi there.", model: "kling-4" }).success, false);
  assert.equal(PartnerVideoSchema.safeParse({ kind: "ugc", script: "No character." }).success, false);
  assert.throws(() => createBodyFor(PartnerVideoSchema.parse({ kind: "avatar", script: "Nobody to say it." })), /characterId or a photoKey/);
});

test("fixed vectors match the partner's client, so the two sides can't drift apart", () => {
  assert.equal(signPartnerRequest("pvp_vector-secret", "1800000000", "user-1", '{"kind":"ugc"}'), "6d89d68e06e22040ee693d3d73767f21e346eabc8ead239fe0bd02b757faf001");
  assert.equal(signPartnerWebhook("whsec_vector", "1800000000", '{"event":"video.updated"}'), "3fd3ad2f1fb65ed4cbae474e1a60026dc24b71127294c5cde498204fd78cec32");
});
