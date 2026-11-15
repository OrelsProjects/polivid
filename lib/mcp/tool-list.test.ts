import assert from "node:assert/strict";
import test from "node:test";
import { MCP_TOOL_DEFS } from "@/lib/tools/registry";
import { CONFIRM_FIELD, CONFIRM_SPEND_TOOL, DECLINE_SPEND_TOOL } from "./canonical";
import { listMcpTools, mcpInstructions, needsConfirmation } from "./tool-list";

test("every MCP tool lists an object schema", () => {
  const tools = listMcpTools();
  // Every registry tool, plus confirm_spend and decline_spend.
  assert.equal(tools.length, MCP_TOOL_DEFS.length + 2);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object", tool.name);
    assert.ok(tool.description && tool.description.length > 0, tool.name);
    assert.equal("$schema" in tool.inputSchema, false, tool.name);
  }
});

test("approval tools, and only those, advertise the confirm token", () => {
  for (const definition of MCP_TOOL_DEFS) {
    const listed = listMcpTools().find((tool) => tool.name === definition.name);
    assert.ok(listed);
    const has = Boolean(listed.inputSchema.properties && CONFIRM_FIELD in listed.inputSchema.properties);
    assert.equal(has, needsConfirmation(definition), definition.name);
    if (definition.effects.spendsCredits || definition.effects.destructive) assert.equal(has, true, definition.name);
  }
});

test("no tool already uses the confirm field name", () => {
  for (const definition of MCP_TOOL_DEFS) {
    const shape = (definition.inputSchema as { shape?: Record<string, unknown> }).shape ?? {};
    assert.equal(CONFIRM_FIELD in shape, false, definition.name);
  }
});

test("instructions name every MCP tool", () => {
  const text = mcpInstructions();
  for (const definition of MCP_TOOL_DEFS) assert.ok(text.includes(`- ${definition.name}:`), definition.name);
});

test("confirm_spend is listed once, takes only the token, and shows the video card", () => {
  const confirm = listMcpTools().filter((tool) => tool.name === CONFIRM_SPEND_TOOL);
  assert.equal(confirm.length, 1);
  assert.deepEqual(confirm[0].inputSchema.required, [CONFIRM_FIELD]);
  assert.deepEqual(Object.keys(confirm[0].inputSchema.properties ?? {}), [CONFIRM_FIELD, "via"]);
  assert.ok((confirm[0]._meta as { ui?: { resourceUri?: string } }).ui?.resourceUri);
  assert.ok(mcpInstructions().includes(CONFIRM_SPEND_TOOL));
});

test("decline_spend is listed once and needs only the token", () => {
  const decline = listMcpTools().filter((tool) => tool.name === DECLINE_SPEND_TOOL);
  assert.equal(decline.length, 1);
  assert.deepEqual(decline[0].inputSchema.required, [CONFIRM_FIELD]);
  assert.ok(mcpInstructions().includes(DECLINE_SPEND_TOOL));
});
