import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderCatalogMarkdown, renderDescription, renderToolIndex, MAX_TOOL_DESCRIPTION_CHARS } from "./describe";
import { HANDLER_KEYS } from "./handlers/keys";
import {
  activeToolNamesFor,
  APPROVAL_TOOL_NAMES,
  CLIENT_TOOL_NAMES,
  COACH_ACTIVE_TOOL_NAMES,
  MCP_TOOL_DEFS,
  TOOL_DEFS,
  toolByName,
} from "./registry";
import { inputFields } from "./schema-fields";
import { toolInputJsonSchema } from "./to-json-schema";

const SNAKE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

test("tool names are unique snake_case", () => {
  const names = TOOL_DEFS.map((definition) => definition.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.match(name, SNAKE);
});

test("server tools have handlers and client tools do not", () => {
  const server = TOOL_DEFS.filter((definition) => definition.runsOn === "server")
    .map((definition) => definition.name)
    .sort();
  assert.deepEqual([...HANDLER_KEYS].sort(), server);
  for (const name of CLIENT_TOOL_NAMES) assert.equal(server.includes(name), false);
  assert.equal(CLIENT_TOOL_NAMES.includes("app_ask_question"), false);
  assert.equal(CLIENT_TOOL_NAMES.includes("app_open_editor"), true);
});

test("every input field describes itself", () => {
  const missing: string[] = [];
  for (const definition of TOOL_DEFS) {
    for (const field of inputFields(definition.inputSchema)) {
      if (!field.description) missing.push(`${definition.name}.${field.name}`);
    }
  }
  assert.deepEqual(missing, []);
  assert.ok((inputFields(toolByName("make_prompt_video")!.inputSchema).length ?? 0) >= 4);
});

test("tool descriptions stay short enough to send on every turn", () => {
  const tooLong = TOOL_DEFS.filter((definition) => (definition.status ?? "live") === "live")
    .map((definition) => ({ name: definition.name, length: renderDescription(definition).length }))
    .filter((item) => item.length > MAX_TOOL_DESCRIPTION_CHARS);
  assert.deepEqual(tooLong, []);
});

test("credit and destructive tools wait for approval", () => {
  for (const definition of TOOL_DEFS) {
    if (definition.effects.spendsCredits || definition.effects.destructive) {
      assert.equal(definition.approval, "user", definition.name);
      assert.equal(APPROVAL_TOOL_NAMES.includes(definition.name), true, definition.name);
    }
  }
});

test("legacy tools stay registered but hidden", () => {
  assert.equal(TOOL_DEFS.some((definition) => definition.name === "create_video" && definition.status === "legacy"), true);
  assert.equal(COACH_ACTIVE_TOOL_NAMES.includes("create_video"), false);
  assert.equal(activeToolNamesFor([]).includes("create_video"), false);
  assert.equal(
    activeToolNamesFor([{ parts: [{ type: "tool-create_video" }] }]).includes("create_video"),
    true,
  );
  assert.equal(renderToolIndex().includes("create_video"), false);
  assert.equal(renderCatalogMarkdown().includes("create_video"), false);
  assert.equal(renderToolIndex().includes("make_prompt_video"), true);
});

test("the catalog file matches the registry", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../../docs/tools/CATALOG.md");
  assert.equal(readFileSync(path, "utf8"), renderCatalogMarkdown());
});

test("mcp tools convert to JSON Schema", () => {
  assert.ok(MCP_TOOL_DEFS.length > 0);
  for (const definition of MCP_TOOL_DEFS) {
    assert.equal(definition.runsOn, "server");
    assert.notEqual(definition.category, "ask");
    assert.notEqual(definition.status, "legacy");
    const schema = toolInputJsonSchema(definition.inputSchema);
    assert.equal(schema.type, "object");
  }
});
