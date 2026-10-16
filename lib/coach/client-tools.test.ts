import assert from "node:assert/strict";
import test from "node:test";
import { isCoachClientTool } from "./client-tools";

test("server tools are not completed in the browser", () => {
  assert.equal(isCoachClientTool("create_video"), false);
  assert.equal(isCoachClientTool("start_production"), false);
  assert.equal(isCoachClientTool("app_ask_question"), false);
  assert.equal(isCoachClientTool("app_open_create"), true);
});
