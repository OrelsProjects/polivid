# Tools

The Coach's tools and the MCP server (`/api/mcp`, see [MCP.md](MCP.md)) come from one registry in `lib/tools`. A tool is defined once. The model, the approval card, the catalog, and the MCP listing all read that definition.

## Layout

| Path | What it is |
| --- | --- |
| `lib/tools/types.ts` | The definition contract: name, guidance, effects, approval, where it runs |
| `lib/tools/defs/` | One file per category. Safe to import from the browser |
| `lib/tools/handlers/` | Server `execute` functions. Not imported by client components |
| `lib/tools/handlers/keys.ts` | The list of server tool names. The test checks it against the definitions |
| `lib/tools/describe.ts` | The text the model sees, the system-prompt index, and the catalog |
| `lib/tools/to-json-schema.ts` | JSON Schema and annotations for the MCP listing |
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

In the Coach, a video or production tool waits unless the person approved a brief or asked to run wild. With either of those, a spend under 200 runs without another ask, and 200 or more still asks. A storyboard asks only at 30 credits or more. The estimate comes from the tool input, or from the saved job for a retry or a production approval. Destructive tools always ask. That check is `coachToolApproval`. Over MCP every `approval: "user"` tool runs only after a quote and a confirm token (see MCP.md).

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

When a chat queues a video, `CoachThread.videoJobId` points at that job. Once the video is ready, `ensureThreadProject` opens an editor project and stores `editProjectId`. The Coach then edits that timeline with the `edit_*` tools. Over MCP, `open_in_editor` returns the `projectId`, and every edit tool takes it.

- The edit tools are free, and together they cover everything the editor UI can do:
  - project title and frame
  - tracks: add, rename, mute, hide, lock, reorder, remove
  - clips: trim, split, move (also across tracks), duplicate, crossfade, transitions, position, size, rotation, fit, opacity
  - text style and animation
  - captions (marked with `role: "caption"`)
  - music, sound effects, and fades
  - pictures, clips, and sounds from uploads
  - camera moves on stills
- `make_*` is for a new video, not a change to the open cut. The finished file is one clip, so a section comes out with `edit_split` and then `edit_remove`.
- Each simple edit is a builder in `lib/tools/handlers/edit-builders.ts`, over a pure function in `lib/editor/coach-edits.ts`. `edit_batch` runs several builders as one save.
- Every agent edit keeps the timeline it replaced in `EditProjectRevision` (50 per project). `edit_undo` steps back one edit at a time, as long as nobody changed the project since. `edit_list_revisions` and `edit_restore_revision` reach older versions.
- The open editor picks up agent saves on its own:
  - Coach edits arrive through `use-remote-edits.ts`.
  - MCP edits arrive through `use-agent-sync.ts`, which polls every 5 s while the tab is visible and nothing is unsaved.

## Create modes

`defineModeTool` copies the title and summary from `lib/video/modes.ts`, so the Tools page and the Coach stay in step. A new mode needs a row there and a `defineModeTool` entry. The handler calls `queueVideoFromInput` with the mode fixed. Attached pictures, the attached file, and the attached character fill in anything the model left empty.

## Test

`lib/tools/registry.test.ts` checks names, handlers, field descriptions, the description length, approval rules, the hidden legacy tool, the catalog file, and that every MCP-tagged tool converts to JSON Schema.
