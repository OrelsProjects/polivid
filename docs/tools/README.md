# Tools

The Coach's tools, and later an MCP endpoint, come from one registry in `lib/tools`. A tool is defined once. The model, the approval card, the catalog, and a future adapter all read that definition.

## Layout

| Path | What it is |
| --- | --- |
| `lib/tools/types.ts` | The definition contract: name, guidance, effects, approval, where it runs |
| `lib/tools/defs/` | One file per category. Safe to import from the browser |
| `lib/tools/handlers/` | Server `execute` functions. Not imported by client components |
| `lib/tools/handlers/keys.ts` | The list of server tool names. The test checks it against the definitions |
| `lib/tools/describe.ts` | The text the model sees, the system-prompt index, and the catalog |
| `lib/tools/to-json-schema.ts` | JSON Schema for a future MCP adapter |
| `docs/tools/CATALOG.md` | Generated. Do not edit by hand |

`lib/coach/tools.ts` is only the AI SDK adapter. Do not add a new capability there.

## Effects and approval

Each tool sets:

- `readOnly` — it does not change the person's account. Maps to MCP `readOnlyHint`.
- `spendsCredits` — it holds or spends credits.
- `destructive` — it cancels work or rewrites history.
- `longRunning` — it calls a model or starts a job.
- `approval` — `user` can show an approval card. `none` runs immediately.

A tool that spends credits or is destructive must use `approval: "user"`. The registry test fails otherwise.

In the Coach, a credit spend under 200 runs without asking. The estimate comes from the tool input, or from the saved job for a retry or a production approval. At 200 credits or more, and for every destructive tool, the person still approves. That check is `coachToolApproval`. An MCP client should keep confirming every `approval: "user"` tool.

`runsOn: "server"` needs a handler. `runsOn: "client"` is finished in the browser (`app_open_*`). Ask tools are client tools with `awaitsPerson: true`: the person answers, and the browser does not run them automatically.

## Add a tool

1. Add a `defineTool` (or `defineModeTool` for a Create mode) in the matching file under `lib/tools/defs/`.
2. Give every input field a `.describe()`. Say what to pass and what to omit.
3. Write `whenToUse` and `avoidWhen` as short rules, including the tool to use instead.
4. Set effects and approval. Credit and destructive tools require approval.
5. If it runs on the server, add the name to `lib/tools/handlers/keys.ts` and a handler in `lib/tools/handlers/`. The handler should call an existing service and return `{ error: "..." }` when the person can fix the request.
6. If it runs in the browser, handle the name in `components/coach/use-coach-client-tools.ts`.
7. Run `npm run tools:docs` so `docs/tools/CATALOG.md` updates.
8. Run `npm test` and `npm run typecheck`.

Keep the description under the cap in `lib/tools/describe.ts`. The full rules belong on the tool. The system prompt only gets a one-line index.

## Change a tool

You can add an optional field, tighten a description, or change `whenToUse` without breaking saved chats. Do not rename a tool, and do not make a required field out of one that old messages omitted. Saved chats are validated against the current schema.

## Retire a tool

Do not delete a tool that a saved chat may mention. Set `status: "legacy"`.

- It stays in the registry, so old messages still validate and an in-flight approval can still run.
- The model does not see it on a new chat. If an older chat already used it, that chat keeps it callable so the approval can finish.
- It is left out of the tool index and the catalog.
- Leave its handler in place.

`create_video` is the example. The mode tools replaced it.

## Project mode

When a chat queues a video, `CoachThread.videoJobId` points at that job. Once the video is ready, `ensureThreadProject` opens an editor project and stores `editProjectId`. The Coach then edits that timeline with the `edit_*` tools. Those tools are free. `make_*` is for a new video, not a change to the open cut. The finished file is one clip, so a section comes out with `edit_split` and then `edit_remove`.

## Create modes

`defineModeTool` copies the title and summary from `lib/video/modes.ts`, so the Tools page and the Coach stay in step. A new mode needs a row there and a `defineModeTool` entry. The handler calls `queueVideoFromInput` with the mode fixed. Attached pictures, the attached file, and the attached character fill in anything the model left empty.

## Test

`lib/tools/registry.test.ts` checks names, handlers, field descriptions, the description length, approval rules, the hidden legacy tool, the catalog file, and that every MCP-tagged tool converts to JSON Schema.
