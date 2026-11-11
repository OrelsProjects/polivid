# PoliVid Studio — design handoff (Phase 0)

Companion to `PoliVid-design-first-agent-prompt.md`. That brief is the assignment; this folder is the reviewed visual and interaction direction for it. Rebuild these screens with the app's real components behind an additive preview route or feature flag. The files here are prototypes, not production code.

Canvas (live, interactive): https://claude.ai/code/artifact/41472235-88ba-44ad-9920-056babd85e67

## What is in this folder

```
design/studio-prototype/
  HANDOFF.md              this file
  canvas.json             artboard index (sizes, order, titles)
  Home.dc.html            Studio shell + Home
  Create.dc.html          Idea → export, 4 stages in one stateful screen
  Project.dc.html         Project editor, ready output (v1) + re-render on edit
  ProjectRecovery.dc.html Same project with failure states and recovery paths
  Sources.dc.html         Pasted writing, suggested concepts, empty-source state
  Batch.dc.html           Article → batch: parent source, 3 child videos
  Projects.dc.html        Project list with filters; a batch is one card
  Publish.dc.html         Later-phase design view (composer, queue, delivery)
  Automations.dc.html     Later-phase design view (series, approval, caps, history)
```

Each `.dc.html` is a self-contained page: the markup is plain HTML with inline styles, the logic is a small `class Component` in a `<script type="text/x-dc">` block at the bottom. Read the markup for layout, copy and states; read `renderVals()` for the state machine and sample data. `{{holes}}`, `<sc-if>` and `<sc-for>` are the prototype's template syntax (conditional / loop); treat them as `{cond && …}` and `.map()` in React. Ignore `./support.js`, `<x-dc>`, `<helmet>` and `data-props` — they are the canvas runtime.

## Visual system

Keeps the existing brand type and primary, moves to a light ground.

| Token | Value | Use |
|---|---|---|
| Ground | `#F6F6F9` | page background |
| Surface | `#FFFFFF` | cards, sidebar |
| Surface muted | `#FAFAFC` | inputs, inset panels |
| Border | `#E4E4EC` | all hairlines (1px) |
| Text | `#141321` | body |
| Text secondary | `#3F3D4F` | labels, secondary copy |
| Text muted | `#6B6A7B` | captions, meta (≥4.5:1 on white) |
| Disabled text | `#8A8899` | disabled controls |
| Primary | `#5B2EE6` | buttons, selection rings, active nav |
| Primary text | `#4A23C9` | links, active nav label |
| Primary tint | `#EFEAFE` | active nav bg, pressed chips |
| Primary soft | `#F4F1FE` | source-passage highlight |
| Primary disabled | `#B9B4D6` | disabled primary button |
| Ready | `#157347` on `#E3F5EA` | rendered / ready / current version |
| Attention | `#9A5B00` on `#FFF1D6` (warn panel `#FFF8EA` / `#E3C78A`) | awaiting approval, low credits, prototype marker |
| Failed | `#C2263A` on `#FDE8EA` (border `#F3B8C0`) | failed render / export |
| Rendering | `#1D5FD6` on `#E6EEFC` | in-progress |
| Neutral chip | `#6B6A7B` on `#EFEFF3` | draft, skipped, queued |
| Placeholder media | `#E9E8F1` (video frame `#141321`) | thumbnails until real previews exist |

Type: **Syne 600** for h1/h2 (30 / 20 / 18 px), **Geist** 400/500/600 for everything else (14 px body, 13 px secondary, 12 px captions, 11 px uppercase section labels with 0.06–0.08 em tracking). Both load from Google Fonts in the prototype; the app already ships Syne + Geist.

Shape: cards 20 px radius (16 px for list cards, 14 px for inner cards, 12 px inputs, 10 px nav items), buttons full pill (999 px), 44 px primary buttons, 36–40 px secondary, hit targets never under 36 px. Selection = 2 px primary ring. No gradients, no shadows except the 4 px tint ring on the active Create button.

Layout: sidebar 248 px (`flex: 1 1 220px; max-width: 248px`), content `flex: 999 1 560px; min-width: 0`, row wraps so the sidebar stacks above content on narrow screens. Content padding 28 px 40 px. Section gap 20–32 px. Grids use `repeat(auto-fit, minmax(min(Npx, 100%), 1fr))` so they collapse to one column on a phone.

## Product structure → routes

| Prototype screen | Sidebar item | Proposed route | Existing route it absorbs |
|---|---|---|---|
| Home | Home | `/` or `/dashboard` | `/dashboard` (greeting, prompt box, recent, showcase) |
| Create | **Create video** (global button) | `/create` | `/create`, the `/create/*` tool pages, `/tools` |
| Project, ProjectRecovery | — (opened from Projects / Home) | `/projects/[id]` | `/videos/[id]`, `/productions/[id]`, `/editor/open/[id]` stays as the advanced timeline |
| Projects | Projects | `/projects` | `/videos`, `/productions` list |
| Sources | Sources | `/sources` | new |
| Batch | — (a project of kind `batch`) | `/projects/[id]` with batch layout | new |
| Publish | Publish | `/publish` | new, design view only |
| Automations | Automations | `/automations` | new, design view only |
| Workspace group | Characters & voices · Brand assets · Billing · Settings | `/characters`, `/brand`, `/billing`, `/settings` | `/characters`, `/billing` (not redesigned in this pass; left disabled in the prototype) |

Coach stays available as a side card inside Create (drawn) and may keep `/coach` as an advanced route. The Productions planning/approval workflow is not a top-level tool: it is reachable from a project ("Advanced" line at the bottom of Projects).

## Screens and what they must do

**Home.** Greeting, one start box with input-kind chips (Idea · Exact script · Article or link · Music or audio · Your media) that continues into Create, a "Needs you" row of actionable items (script awaiting approval → Batch; failed scene → ProjectRecovery; ready → Project), a "Continue" row of recent projects, and a "Start from a showcase" row with *Create similar* (prefills Create). Prototype marker pill top right.

**Create.** One screen, four stages, shared state:
1. *Configure* — input kind + brief; **Presentation** (Motion graphics 2 cr/s · Generated scenes 10 cr/s · Illustration 4 cr/s · Your media, disabled until media is supplied) separate from input; Style cards (Auto, Bold, Editorial, Minimal, Rounded 3D, Ultra realism — the existing 29 presets fit here); Format (9:16 / 1:1 / 16:9); Length (30/60/90); Voice select. Right rail: live cost estimate = length × presentation rate, balance, the hold/refund rule, and **Plan script & scenes** (free, nothing renders).
2. *Script & scenes* — scene list (select), editable narration + on-screen text per scene, visual note, **Approve script & render** (holds the credits) / Back to settings. Edits here go into the render unchanged.
3. *Render* — progress, per-scene Rendered/Rendering/Queued, "you can leave", Cancel (refunds the hold). Simulated with a timer in the prototype.
4. *Output* — fixed version v1, Download MP4, Fix a scene (→ Project), Open timeline editor (disabled), pointer to Publish, Make another.

**Project.** Breadcrumb, status chip + lineage line, scene list + scene editor + right rail (output placeholder, versions, details). Editing narration/on-screen text marks the scene *Changed* and surfaces **Re-render N changed · cost** while v1 stays downloadable; versions panel shows "v2 · not rendered".

**ProjectRecovery.** Same project in trouble: scene 2 failed (provider error, refunded) with *Retry · 20 credits*, *Drop the reference picture and retry*, *Export without scene 2* (partial export); a low-balance panel when retry can't be afforded (*Buy credits*, *Shorten scene to 5s · 10 credits*, *Not now*); an export-failed panel after render (*Retry export · free*). Download button is disabled until there is an MP4. Credits panel shows held / charged / refunded / balance. Render status and publish status are explicitly separate.

**Sources.** Add-a-source card (paste; RSS and Substack import disabled, "later"), saved sources list, detail with excerpt, and **suggested concepts (up to three, never padded)** with source passage, angle and shape; tick concepts → **Draft N scripts → batch**. One source shows the empty state ("too short to suggest concepts": add text, or make a single video).

**Batch.** Parent source + shared settings; child list with per-item status (Ready · v1 / Render failed / Awaiting approval / Approved · not generated / Rendering); selected item shows its source passages, editable script (locked once approved; *Reopen for edits* withdraws approval), estimated cost, approval, generation and output rows, and the one right action: **Approve script → Generate · hold N credits → Download MP4 · vN**, or **Retry** after a failure. Header: *Download N ready*. Right rail: shared creative settings (changes apply only to unrendered items), credits charged/held/pending. One failed item never hides the others.

**Projects.** Filters (All / Drafts / Rendering / Ready / Needs attention / Batches) with counts; a batch is one card with three thumbnails; empty-filter state.

**Publish (design view).** Warning band: no account connected, nothing schedules, integration controls disabled. Left: finished versions only (render status shown). Composer bound to one fixed media version; caption; destination chips disabled "not connected"; datetime (Asia/Jerusalem) and *Add to queue* disabled; *Download this version instead* works. Right: week strip (empty queue), delivery-status vocabulary (Queued / Delivered / Delivery failed) separate from render status.

**Automations (design view).** Warning band. Series list (Paused/Active/Draft). Settings: trigger (from Sources), creative settings (same object a batch uses), **Approval**: Review first (default) vs Generate without review, which reveals an explicit permission checkbox; cap per run and per month; skip rules (same source already ran, under 300 words); Pause/Resume. Run history table (drafts awaiting review, rendered, skipped, stopped at cap with drafts kept). *New series* disabled.

## Decision log

- Light theme, Revid-like density; brand type and violet kept so the product is still recognisably PoliVid.
- Input and presentation are two separate choices on Create; characters are an optional reusable asset chosen as a voice/reference, not a tool.
- The 10 "tools" collapse into Create's input kind × presentation. Tool-specific pages become prefilled Create states.
- Projects is the single list; a batch is a project with children. Productions' plan-review workflow becomes an advanced path from a project.
- Credits: estimate before planning, hold at render start, charge on success, refund per failed scene. Nothing is charged for scripting. The prototype prints these rules next to every money-related button.
- Versions are immutable outputs (v1, v2…). Edits never mutate a downloaded file; Publish and Automations reference a version, never the draft.
- Every simulated action is labelled "(simulated)" in the UI; sample balances are labelled "Sample".
- Disabled, not hidden: controls with no implemented design behaviour (timeline editor, destinations, New series, Workspace nav) are present and disabled so the structure stays visible.
- Accessibility: real `<button>`/`<a>`/`<input>`+`<label>`, `aria-pressed` on toggles, `aria-current` on nav, `role="status"` for simulated results, 4.5:1 text contrast, `:focus-visible` ring, reduced-motion respected.

## Open questions for the owner

1. Is "Presentation" the right word for motion graphics / generated scenes / illustration / your media, or should it read "Look"?
2. Coach as a side card inside Create (as drawn) or its own route kept in the sidebar?
3. Should the Workspace screens (Characters & voices, Brand assets, Settings) get a pass now, or stay as the existing pages behind the new shell?
4. Phone layout: the pages wrap, but no phone-specific artboards were drawn. Worth a pass before Phase 1?

## Implementation notes for the coding agent

- Build behind `/studio/*` (or a `studio` flag) and leave current routes untouched; link both ways.
- Use VideoJob as the lifecycle for both a single video and a batch child; a batch is a parent record with ordered children sharing a settings object and a source reference with passage offsets.
- The Create stage machine maps cleanly onto: configure (client state) → plan (server, free) → approve + hold → render (job) → output (version). Keep approved scripts immutable once a hold exists.
- Recovery actions in ProjectRecovery each correspond to one job transition: retry scene (new hold for that scene only), drop reference (same, with the reference stripped), partial export (export job over successful scenes), retry export (export job, no hold).
- Replace placeholder thumbnails with the first rendered frame or the style sample; keep the 9:16 / 1:1 / 16:9 aspect boxes.
