import type { z } from "zod";
import { MCP_TOOL_DEFS } from "./registry";
import type { ToolEffects } from "./types";

/** JSON Schema for a tool input. Zod 4 emits this directly. */
export const toolInputJsonSchema = (schema: z.ZodType) => schema.toJSONSchema();

/**
 * MCP tool annotations. `readOnlyHint` and `destructiveHint` come from the tool's effects.
 * Anything that is not read-only is treated as open-world, because it can change the person's account or call a model.
 */
export const mcpAnnotations = (effects: ToolEffects) => ({
  readOnlyHint: effects.readOnly,
  destructiveHint: effects.destructive,
  openWorldHint: !effects.readOnly,
});

/** The tools an MCP adapter should list. Approval is still required for tools with `approval: "user"`. */
export const mcpToolSpecs = () =>
  MCP_TOOL_DEFS.map((definition) => ({
    name: definition.name,
    title: definition.title,
    inputSchema: toolInputJsonSchema(definition.inputSchema),
    annotations: mcpAnnotations(definition.effects),
  }));
