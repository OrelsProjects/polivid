# Studio prototype

Local preview of the short-video studio. Open [http://localhost:3100/studio](http://localhost:3100/studio) while signed in.

The screens follow `design/studio-prototype/`. Home, Projects, Create, Sources, and Publish read and write the real account: videos, jobs, credits, and saved sources. Create queues a real video job. Sources are stored in the `sources` table, and selected concepts each become their own video job. Publish lists finished videos and can download them. Scheduling and Automations are still design-only.

## Routes

| Screen | Path | Design file |
|---|---|---|
| Home | `/studio` | `Home.dc.html` |
| Create (configure, script, render, output) | `/studio/create` | `Create.dc.html` |
| Projects | `/studio/projects` | `Projects.dc.html` |
| Video project, ready | `/studio/projects/click-then-sleep` | `Project.dc.html` |
| Video project, recovery states | `/studio/projects/why-sleep-matters` | `ProjectRecovery.dc.html` |
| Article batch | `/studio/projects/october-newsletter` | `Batch.dc.html` |
| Sources | `/studio/sources` | `Sources.dc.html` |
| Publish (design only) | `/studio/publish` | `Publish.dc.html` |
| Automations (design only) | `/studio/automations` | `Automations.dc.html` |

## App shell

The whole signed-in app uses the Studio sidebar (`components/studio/studio-frame.tsx`) in light mode. The existing pages keep their own layouts and features; only the shell and the colours changed.

| Sidebar item | Goes to |
|---|---|
| New ad | `/create` (the campaign ad wizard) |
| Home | `/dashboard` |
| My ads | `/videos` (also current on `/productions` and `/editor`) |
| Coach | `/coach` |
| Campaign | `/campaign` |
| Candidate & spokespeople | `/characters` |
| Advanced tools | `/tools` (also current on `/create/advanced` and `/create/<mode>`) |
| Billing | `/billing` |

Sources, Publish and Automations are no longer in the sidebar; their routes under `/studio/*` still work and stay design-only. Brand assets and Settings were removed. The plan card and account row at the bottom are server-rendered slots (`components/studio/studio-account.tsx`). Below `md` the sidebar becomes a top bar with a menu. Coach and the Editor stay full-screen, without the sidebar, in light mode.

The Studio versions of Home, Create, Projects and the project page (`/studio`, `/studio/create`, `/studio/projects`, `/studio/projects/[id]`) still work but are not linked from the sidebar: the existing pages are used instead.

## Decisions

- Light theme is the default (`:root` in `app/globals.css`). The old dark palette is `.dark`; only the marketing page, sign-in and two internal preview pages still opt into it.
- Screens that are not wired to real data yet keep their own sample state and say so.
- The sidebar is the full one from `Home.dc.html` on every screen. The Recovery screen swaps its plan card for the low "Starter plan" balance (`useStudioPlan` in `components/studio/studio-frame.tsx`).
- A batch is a project. Recovery states are a second sample project, not a separate route.
- Credit rates on Create (2 / 10 / 4 credits per second) are sample numbers.
- On a phone the sidebar becomes a top bar with a menu, like the previous app. No phone layout has been designed yet.

## What a reviewer can try

1. Home: change the input chip, continue into Create, or open a Needs-you card.
2. Create: switch presentation and length and watch the estimate, edit a scene, approve, watch the simulated render, download.
3. Projects: filter, open Click, Then Sleep, edit a scene, see Re-render and the unrendered v2 appear, download.
4. Why sleep matters: retry with 12 sample credits (not enough), buy sample credits, retry, then retry the failed export.
5. Sources: compare the 3-concept, 2-concept, and too-short sources. Draft the selection into the October batch.
6. Batch: approve, generate, retry the failed video, download a ready one.
7. Publish and Automations: disabled integration controls, pause, caps, approval radios.

## Not in this prototype

Real MP4 export for motion plans, source models, scheduling, and automations that run. Those are later phases in the Studio plan.

## For deletion

Every file below starts with a `FOR DELETION` comment, so `grep -rn "FOR DELETION" app components lib` lists them. The old dark navigation (`components/app-nav.tsx`, `mobile-nav.tsx`, `user-menu.tsx`, `billing/plan-card.tsx`) was deleted on 2026-10-24.

| File | Why |
|---|---|
| `lib/store/studio-slice.ts` (and its line in `lib/store/store.ts`), `lib/studio/model.ts` | Unused leftovers of the first Studio preview. |
| `app/(preview)/studio/characters/page.tsx`, `app/(preview)/studio/billing/page.tsx` | Unused leftovers of the first Studio preview, not linked from the sidebar. |
| `.dark` in `app/globals.css` | Remove last: the marketing page, sign-in and the two preview pages under `app/picture-preview` and `app/shot-plan-preview` still use it. |
