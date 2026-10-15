# Architecture

PoliVid turns a prompt into a short video. Visuals are drawn with code. When the video uses numbers, each one comes from a source. This doc explains how that works and where each piece lives.

## The core rule: the AI arranges, code computes

Diffusion video tools and plain LLM scripts invent numbers. PoliVid's promise is that it never does, so the pipeline is split in two:

1. **Facts come only from sources.** The research step returns facts. Each fact is a value plus the exact URL and sentence it came from.
2. **The AI writes a scene plan, not numbers.** Titles, headlines and narration use `{fact_id}` placeholders, and code fills them in from the fact's value.
3. **A deterministic linter rejects any plan that types a number itself** (four-digit years are the only exception), references an unknown fact, misuses a scene type, or quotes something that isn't a researched verbatim quote. The model gets one repair attempt; then the video fails visibly instead of shipping a wrong number.
4. **Factual videos end with a "Sources" scene**, and the video page lists each fact with its source link and quote.

The contract is the Zod schema in `lib/video/schema.ts`. The linter is `lib/video/lint.ts`.

## Generation pipeline

```
Create page (components/generator.tsx)
  POST /api/videos  {prompt, format, length}         app/api/videos/route.ts
    auth()                                           signed-in user required (401 otherwise)
    generateVideo(userId, input, onStep)             lib/video/generate.ts (progress + saving)
      runResearch     OpenRouter + web plugin -> facts, quotes, search sources   lib/video/pipeline.ts
      buildScenePlan  structured output -> ScenePlan, lintPlan, 1 repair call    lib/video/pipeline.ts
      check           refuse the plan if the number check still fails
      save            createVideo(userId, record) -> Postgres                    lib/videos.ts
  <- NDJSON stream: {"type":"step",...} per stage, then {"type":"done",...}
  -> redirect to /videos/[id]
```

- **Progress streaming.** The route returns `application/x-ndjson`. The client reads it line by line and lights up each step.
- **Failures are saved too** (`status: "failed"`, with the error and any facts found), so the video page can show what went wrong.
- **Demo mode.** With no `OPENROUTER_API_KEY`, `generateDemo` walks through the same steps and saves the fictional "why sleep matters" sample (`lib/video/demo.ts`). Every frame of it says SAMPLE DATA.
- **Unverified sources.** If a fact's source URL isn't among the URLs the web search actually returned, it's flagged on the sources panel ("Source not in search results, check it"). **Known gap:** with structured output, OpenRouter currently returns no search URLs to the AI SDK (`result.sources` is empty), so this flag never fires yet. Fetching each source page and checking that the number appears is the fix; see "What's next".
- **No DB or auth in the pipeline.** `lib/video/pipeline.ts` holds the model calls and checks, so `npm run try -- "story"` (`scripts/try-pipeline.ts`) can run it from the terminal for prompt tuning.
- **Units are never doubled.** `fillPlaceholders` drops a fact's unit when the narration already says it right after the placeholder ("{sleep_hours} hours").
- **Prompts.** `lib/ai/prompts.ts`: any topic, primary sources first when there are figures, copy numbers exactly.
- **Model.** `lib/ai/openrouter.ts`: `POLIVID_MODEL`, defaulting to `anthropic/claude-opus-5.5`.
- **Durations.** `normalizePlan` always appends the Sources scene and scales scene durations to the chosen length (2/30/60/90s).

## Rendering (Remotion)

| File | Role |
|---|---|
| `components/video/composition.tsx` | The video: background, progress bar, brand mark, SAMPLE DATA badge, one `<Series.Sequence>` per scene, word-by-word captions, and a "Source: domain · period" footer on every scene |
| `components/video/scenes.tsx` | Scene renderers: `hook`, `big_number` (counts up to the exact source value), `bars`, `line` (drawn path; only source values are labeled, with no computed axis ticks), `quote`, `sources` |
| `components/video/theme.ts` | Palette: navy and amber, deliberately free of party red and blue |
| `components/video/remotion-players.tsx` | Remotion `<Player>` and `<Thumbnail>` |
| `components/video/video-player.tsx` | Wrappers that load the above **client-side only** (`next/dynamic`, `ssr: false`), because Remotion reads the clock during render, which Cache Components rejects during prerender |

The preview runs in the browser at no cost. **MP4 export isn't built yet.** The plan is Remotion Lambda rendering the same composition, so preview and export can't drift apart.

Sizes: `9:16` is 1080×1920, `16:9` is 1920×1080, `1:1` is 1080×1080, all at 30 fps (`dimensionsFor`, `FPS` in `lib/video/schema.ts`). Layouts adapt by orientation.

## Auth

**Auth.js v5 (NextAuth)** is configured in `auth.ts`, with endpoints at `app/api/auth/[...nextauth]/route.ts`.

- **Providers:**
  - Google OAuth.
  - Resend magic-link email.
  - Credentials come from env (`AUTH_GOOGLE_*`, and `AUTH_RESEND_KEY` or `RESEND_API_KEY`; see [SETUP.md](SETUP.md)).
- **Database sessions** through the Prisma adapter. The browser holds only an opaque session cookie, so signing out or deleting a `Session` row ends the session immediately.
- **Two layers of protection:**
  1. `proxy.ts` (Next 16's name for middleware) does an *optimistic* check. If there's no session cookie on `/dashboard`, `/create` or `/videos`, it redirects to `/login?callbackUrl=...`. It makes no database call.
  2. `lib/session.ts` `getCurrentUser()` does the *real* check close to the data. Every data read (`lib/videos.ts`) and the generate API route resolve the user themselves.
- **Ownership.** Video reads always filter by the signed-in user's id. `lib/videos.ts` has no function that takes a user id from a caller.
- **Sign-in pages.**
  - `app/login` holds the Google button and email form, and shows Auth.js error codes in plain language.
  - `app/login/check-email` is shown after a magic link is sent.
  - Post-login redirects only accept same-site relative paths (`safeCallbackUrl`).

## Data model

`prisma/schema.prisma`, on Postgres (AWS RDS; setup in [SETUP.md](SETUP.md)):

- `User`, `Account`, `Session`, `VerificationToken`: the standard Auth.js adapter tables.
- `Video`: one row per generation.
  - Scalar columns: `prompt`, `format`, `length`, `status`, `title`, `model`, `demo`, `error`.
  - JSON columns: `facts`, `quotes`, `plan`, `searchSources`. They match the types in `lib/video/schema.ts`, and `createVideo` and `toRecord` in `lib/videos.ts` convert between rows and `VideoRecord`.

## Next.js 16 notes (Cache Components is on)

- **Read request data inside `<Suspense>`.** Anything that reads cookies, the session, `searchParams`, `params` or the database must sit inside a Suspense boundary. Pages keep their static chrome outside it, and data components (`DashboardContent`, `VideoGrid`, `VideoDetail`, `UserMenu`) inside.
- **Dynamic params are awaited low in the tree.** For example `params.then(({ id }) => <VideoDetail id={id} />)` inside Suspense, so the page shell still prerenders.
- **Env reads are request-time.** `connection()` makes the "demo mode" and model indicators read env at request time, so adding a key doesn't need a rebuild.
- **Read the bundled docs first.** Next.js docs ship in `node_modules/next/dist/docs/`; read them before changing framework-level code (see `AGENTS.md`).

## Folder map

```
app/
  page.tsx                    landing page (static; live demo video)
  login/                      sign-in page, server actions, check-email page
  (app)/layout.tsx            signed-in shell: sidebar, plan/model status, user menu
  (app)/dashboard/            prompt box, stats, recent videos
  (app)/create/               generator UI (format, length, progress)
  (app)/videos/               video list and video page (player, sources, script)
  (app)/productions/          staged AI production: plan, generate, review
  api/videos/route.ts         POST: generate a video, streams progress
  api/productions/            create, plan, approve, and resume productions
  api/auth/[...nextauth]/     Auth.js endpoints
auth.ts                       Auth.js config
proxy.ts                      optimistic sign-in redirect
components/
  video/                      Remotion composition, scenes, players
  ui/                         shadcn components (Base UI)
  generator.tsx, prompt-box.tsx, app-nav.tsx, user-menu.tsx, login-form.tsx, ...
lib/
  video/schema.ts             LLM <-> renderer contract (Zod) and shared types
  video/lint.ts               deterministic number and quote checks
  video/format.ts             number formatting and {placeholder} filling
  video/pipeline.ts           model calls + checks (no DB/auth; used by the app and scripts/)
  video/generate.ts           pipeline + progress steps + saving
  video/demo.ts               fictional sample video
  production/                 staged production schemas, planner, jobs, adapters
  ai/openrouter.ts, ai/prompts.ts
  db.ts, session.ts, videos.ts
prisma/schema.prisma
scripts/try-pipeline.ts       run the pipeline from the terminal (npm run try)
docs/                         PLAN.md, SETUP.md, ARCHITECTURE.md, PRODUCTION.md
```

## What's next

1. **MP4 export** via Remotion Lambda, triggered from the video page; the button is a placeholder today.
2. **Voiceover:** TTS per scene with word timestamps driving the captions, plus recording your own narration.
3. **Stronger verification:** fetch each source page and confirm the number and quote appear in it. Today the search-URL check is the only automated source check, and it's inactive (see "Unverified sources" above).
4. **Editing:** change narration (re-linted), reorder or delete scenes, brand kit.
5. **Payments** (Stripe) and plan limits.
