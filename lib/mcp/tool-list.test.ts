import assert from "node:assert/strict";
import test from "node:test";
import { MCP_TOOL_DEFS } from "@/lib/tools/registry";
import { CONFIRM_FIELD } from "./canonical";
import { listMcpTools, mcpInstructions, needsConfirmation } from "./tool-list";

test("every MCP tool lists an object schema", () => {
  const tools = listMcpTools();
  assert.equal(tools.length, MCP_TOOL_DEFS.length);
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
