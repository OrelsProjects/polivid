import assert from "node:assert/strict";
import test from "node:test";
import { resumeTarget } from "./resume";

test("failed generation jobs retry those jobs", () => {
  assert.equal(resumeTarget({ failedJobCount: 2, hasDevelop: true }), "jobs");
});

test("a failed plan with a script retries structure", () => {
  assert.equal(resumeTarget({ failedJobCount: 0, hasDevelop: true }), "structure");
});

test("a failed plan with no script retries develop", () => {
  assert.equal(resumeTarget({ failedJobCount: 0, hasDevelop: false }), "develop");
});
