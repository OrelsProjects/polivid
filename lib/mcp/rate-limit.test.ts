import assert from "node:assert/strict";
import test from "node:test";
import { rateLimited } from "./rate-limit";

test("allows up to the limit per window", () => {
  const key = `t-${Math.random()}`;
  assert.equal(rateLimited(key, 2, 1000, 0), false);
  assert.equal(rateLimited(key, 2, 1000, 10), false);
  assert.equal(rateLimited(key, 2, 1000, 20), true);
  assert.equal(rateLimited(key, 2, 1000, 1000), false);
});
