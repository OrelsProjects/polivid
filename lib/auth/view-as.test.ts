import assert from "node:assert/strict";
import { before, test } from "node:test";
import { isAdminEmail, readViewAs, signViewAs, VIEW_AS_TTL_MS } from "./view-as";

before(() => {
  process.env.AUTH_SECRET = "test-secret";
  process.env.ADMIN_EMAILS = "Owner@Example.com, second@example.com";
});

test("only listed emails are admins, whatever their case", () => {
  assert.equal(isAdminEmail("owner@example.com"), true);
  assert.equal(isAdminEmail("SECOND@example.com"), true);
  assert.equal(isAdminEmail("someone@example.com"), false);
  assert.equal(isAdminEmail(null), false);
});

test("a signed choice names the user, for the admin who made it", () => {
  const value = signViewAs("admin-1", "user-2", 1_000);
  assert.equal(readViewAs(value, "admin-1", 2_000), "user-2");
});

test("another admin, a changed value, or an expired one is ignored", () => {
  const value = signViewAs("admin-1", "user-2", 1_000);
  assert.equal(readViewAs(value, "admin-9", 2_000), null);
  assert.equal(readViewAs(value, "admin-1", 1_000 + VIEW_AS_TTL_MS + 1), null);
  const [body, sig] = value.split(".");
  const forged = Buffer.from(JSON.stringify({ a: "admin-1", u: "user-3", e: 9e15 })).toString("base64url");
  assert.equal(readViewAs(`${forged}.${sig}`, "admin-1", 2_000), null);
  assert.equal(readViewAs(`${body}.x${sig}`, "admin-1", 2_000), null);
  assert.equal(readViewAs(undefined, "admin-1"), null);
  assert.equal(readViewAs("garbage", "admin-1"), null);
});
