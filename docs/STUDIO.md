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

The whole signed-in app uses one floating top bar (`components/studio/studio-frame.tsx`) on a neutral black theme. The existing pages keep their own layouts and features; the shell, the colours and the typeface are shared.

| Part of the bar | What it holds |
|---|---|
| Left | The PoliVid mark (goes to `/dashboard`) and a Create button (`/create`). |
| Centre | An icon rail: Coach, Image to Video, Create video, Music to Video, Shorts, Motion graphics, Add captions, Characters & voices, Sources, Publish, Automations, All tools, then Home. Each icon shows its name on hover. The longest matching path marks the current one. |
| Right | Media (`/videos`, also current on `/productions` and `/editor`), the credit balance with Upgrade or Manage (`/billing`), and the account menu (Billing, Sign out, and which model is live). |

Below `lg` the rail is replaced by a menu button that lists every destination by name. The balance and account are server-rendered slots (`components/studio/studio-account.tsx`). Coach and the Editor stay full-screen, without the bar, on the same theme.

Home (`/dashboard`) follows the same layout top to bottom: a carousel of wide cards, Featured, the workspace numbers, the tool wall, a promo with four shortcuts, recent videos, Characters & voices, the Coach banner, and a link to every tool. Its pictures are the look posters in `public/presets`.

The Studio versions of Home, Create, Projects and the project page (`/studio`, `/studio/create`, `/studio/projects`, `/studio/projects/[id]`) still work but are not linked from the bar: the existing pages are used instead.

## Decisions

- The signed-in app uses `.night` in `app/globals.css`: black surfaces, white type, one blue for actions, set in Poppins. The shell puts the class on its root, and `ThemeScope` puts it on `<html>` so menus and dialogs match. Light (`:root`) stays the default for the public pages. The old dark palette is `.dark`; only sign-in and two internal preview pages still opt into it.
- Screens that are not wired to real data yet keep their own sample state and say so.
- The top bar is the same on every screen. The Recovery screen swaps the balance for a low sample one (`useStudioPlan` in `components/studio/studio-frame.tsx`).
- A batch is a project. Recovery states are a second sample project, not a separate route.
- Credit rates on Create (2 / 10 / 4 credits per second) are sample numbers.
- On a phone the icon rail becomes a menu button. The pages themselves have no separate phone design yet.

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
| `app/(preview)/studio/characters/page.tsx`, `app/(preview)/studio/billing/page.tsx` | Unused leftovers of the first Studio preview, not linked from the top bar. |
| `.dark` in `app/globals.css` | Remove last: the marketing page, sign-in and the two preview pages under `app/picture-preview` and `app/shot-plan-preview` still use it. |
