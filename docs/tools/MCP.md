# MCP adapter

Not built yet. This is the contract so an `/api/mcp` route can be added later without redesigning the tools.

The registry is the source. Do not keep a second list of MCP tools.

## What gets exposed

`MCP_TOOL_DEFS` in `lib/tools/registry.ts` is the list. A tool is included when all of these are true:

- `status` is live (legacy tools such as `create_video` are out)
- `runsOn` is `server` (browser navigation has no meaning for a remote client)
- `category` is not `ask` (`app_ask_question` is a chat card)
- `surfaces` includes `"mcp"`

`mcpToolSpecs()` in `lib/tools/to-json-schema.ts` maps each of those to:

| Registry | MCP tool |
| --- | --- |
| `name` | `name` |
| `title` | `title` |
| `renderDescription(definition)` | `description` |
| `toolInputJsonSchema(inputSchema)` | `inputSchema` |
| `mcpAnnotations(effects)` | `annotations` |

Annotations:

- `readOnlyHint` is `effects.readOnly`
- `destructiveHint` is `effects.destructive`
- `openWorldHint` is the opposite of `readOnly`, because a tool that is not read-only can change the person's account or call a model

`npm test` already checks that every included schema converts with Zod's `toJSONSchema()`.

## Approval

Tools with `approval: "user"` are in the list, because a remote client should still be able to queue a video. They must not run the moment the model calls them.

The first adapter should do one of these, in order of preference:

1. Map `approval: "user"` to MCP elicitation: send the tool title and `approvalDetail(input)` to the person, and call the handler only after they accept.
2. Until elicitation exists, omit tools where `approval === "user"` from the advertised list. The filter is `MCP_TOOL_DEFS.filter((tool) => tool.approval === "none")`.

Do not execute an approval tool from the adapter with no confirmation. That spends credits.

## Who the tools run as

Every handler takes a `ToolContext`:

- `userId` from the authenticated session. Never from the model.
- `attachedReferenceKeys`, `attachedCharacterId`, and `attachedMedia`. A remote MCP client has no chat composer, so pass empty arrays and an empty character id unless the client sends attachments in a way you have defined.
- `timezone` from the client when you have it, otherwise `UTC`.

The route authenticates the same way as `/api/videos`: no session, no tools. The handler then uses that user id for every read and write, which is what `queueVideoFromInput` and the other services already expect.

## Where the route would live

`app/api/mcp/route.ts`, using the packages already in the repo (`@ai-sdk/mcp` and `@modelcontextprotocol/sdk`). Sketch, not wired up:

```ts
import { mcpToolSpecs } from "@/lib/tools/to-json-schema";
import { renderDescription } from "@/lib/tools/describe";
import { toolHandlers } from "@/lib/tools/handlers";
import { MCP_TOOL_DEFS } from "@/lib/tools/registry";

const tools = MCP_TOOL_DEFS.filter((definition) => definition.approval === "none").map((definition) => ({
  name: definition.name,
  description: renderDescription(definition),
  inputSchema: mcpToolSpecs().find((spec) => spec.name === definition.name)?.inputSchema,
  annotations: mcpToolSpecs().find((spec) => spec.name === definition.name)?.annotations,
  execute: (input: unknown, ctx: { userId: string }) =>
    toolHandlers[definition.name as keyof typeof toolHandlers](input, {
      userId: ctx.userId,
      attachedReferenceKeys: [],
      attachedCharacterId: "",
      attachedMedia: [],
      timezone: "UTC",
    }),
}));
```

The real route should build each spec once, not call `mcpToolSpecs()` twice, and should refuse approval tools until elicitation is in place. Auth wraps the handler so `userId` comes from the session.
