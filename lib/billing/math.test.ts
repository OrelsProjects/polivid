import assert from "node:assert/strict";
import test from "node:test";
import { addMonthsUtc, jobCreditsFromUsd, nextRefillAt, splitRefund, splitSpend, usdToCredits } from "./math";

test("maps provider USD to credits at 1 credit per cent, rounded up", () => {
  assert.equal(usdToCredits(3), 300);
  assert.equal(usdToCredits(0.0425 * 5), 22);
  assert.equal(jobCreditsFromUsd(0.01), 5);
  assert.equal(jobCreditsFromUsd(0), 5);
  assert.equal(jobCreditsFromUsd(3), 300);
});

test("spends plan credits before bonus credits", () => {
  assert.deepEqual(splitSpend(80, 40, 50), { fromPlan: 50, fromBonus: 0 });
  assert.deepEqual(splitSpend(80, 40, 100), { fromPlan: 80, fromBonus: 20 });
  assert.equal(splitSpend(80, 40, 121), null);
  assert.deepEqual(splitSpend(0, 10, 10), { fromPlan: 0, fromBonus: 10 });
});

test("refunds unused credits last-in first-out, bonus then plan", () => {
  assert.deepEqual(splitRefund(80, 20, 20), { fromPlan: 0, fromBonus: 20 });
  assert.deepEqual(splitRefund(80, 20, 50), { fromPlan: 30, fromBonus: 20 });
  assert.deepEqual(splitRefund(80, 0, 10), { fromPlan: 10, fromBonus: 0 });
});

test("advances a yearly plan refill one month at a time without stacking", () => {
  const from = new Date("2026-01-15T00:00:00.000Z");
  const now = new Date("2026-04-02T00:00:00.000Z");
  const next = nextRefillAt(from, now);
  assert.equal(next.toISOString(), "2026-04-15T00:00:00.000Z");
  assert.equal(addMonthsUtc(from, 1).toISOString(), "2026-02-15T00:00:00.000Z");
});
