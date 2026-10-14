# PoliVid PRD

**Owner:** Orel · **Status:** v1 in progress · **Last updated:** 2026-10-14

> **Working name.** "PoliVid" stays until the product is positioned. The name, niche and go-to-market are decided *after* the app works end to end.

**Related docs:**
- [PLAN.md](PLAN.md): earlier strategy and go-to-market research (written for the news/politics wedge, which is now paused).
- [ARCHITECTURE.md](ARCHITECTURE.md): how it's built.
- [SETUP.md](SETUP.md): environment and accounts.

**Status tags used in this doc:** ✅ built · 🔜 next (v1) · 🗓️ later (v1.x / v2) · ❌ out of scope.

---

## 1. Summary

PoliVid turns a prompt into a finished short video. You type a topic, paste text, or describe what you want. PoliVid writes the script and plans the scenes, then narrates them with AI voice and renders an MP4 with animated text, charts, images and word-timed captions.

Visuals are **drawn with code** (Remotion), not generated pixel by pixel. That makes videos sharp, on-brand, editable scene by scene and cheap to render. Any numbers come from real data, never made up by the model.

**Current goal:** a fully working video generator, from prompt to downloadable MP4, for any topic. Niche, positioning and pricing come later.

## 2. Problem

People who publish online need a steady flow of short videos for YouTube Shorts, TikTok, Reels, LinkedIn and Substack. Today they:

- **Edit by hand** in CapCut, Canva or Premiere. Good results, but 30–90 minutes per video.
- **Use AI video generators** (Revid, InVideo, Pictory). Fast, but generic-looking, hard to edit precisely, and they invent facts and numbers.
- **Film themselves.** Not everyone wants to, and it doesn't scale.

There's a gap for a tool that is **fast, precise and editable**: crisp motion graphics, real numbers, and changes made per scene instead of re-rolling the whole video.

## 3. Users (for now)

At this stage the user is **anyone who needs short explainer-style videos**: writers, newsletter authors, educators, marketers and faceless channel creators. The first real user is the founder: WriteStack's own videos act as the showcase ("made with PoliVid").

**Jobs to be done**
1. When I have a topic or idea, I want a polished short video in minutes, so I can post consistently.
2. When I've written an article or newsletter, I want it as a video, so I can reach video platforms without filming myself.
3. When my story has numbers, I want them shown as clean charts that are correct, so the video looks professional and holds up to scrutiny.
4. When a scene is wrong, I want to fix just that scene, so I don't have to regenerate everything.

A specific niche is chosen after v1 works (see section 14).

## 4. Product principles

1. **Prompt to MP4, end to end.** Every feature serves the core loop: prompt → script → scenes → voice → video → download.
2. **Code draws the visuals.** Scenes are templates filled with data, so output is sharp, consistent and editable.
3. **Never invent a number.** When a video uses figures, the AI writes placeholders and code fills in values from a fact list with sources. A plan that types a raw number is rejected.
4. **Sources when there are facts.** Factual videos get a source footer on data scenes and a sources panel on the video page. A closing sources card is optional.
5. **Real people are allowed.** Videos can show, depict or voice real people, including AI-generated likenesses and voices. Anything AI-generated is labeled (C2PA metadata, plus each platform's AI-content label when posting).
6. **A person approves before anything leaves the app.** You preview before exporting, and nothing auto-publishes.
7. **Fail visibly.** A failed step shows the reason and lets you retry. It is never silently "fixed".

## 5. Goals and success metrics (v1)

| Goal | Metric | Target |
|---|---|---|
| Works end to end | Prompts that produce a downloadable MP4 without manual fixes | ≥90% of 50 varied test prompts |
| Speed | Median time from prompt to finished MP4 (60s video) | Under 5 minutes |
| Quality | Founder would post the video as-is | ≥7 of 10 test videos |
| Accuracy | Wrong numbers in factual videos | 0 |
| Unit cost | All-in cost per 60s video | ≤$0.50 |
| Dogfooding | WriteStack videos made with PoliVid | ≥10 |

**Non-goals for v1:**
- choosing a niche or positioning,
- talking-head avatars,
- AI-generated video footage (text-to-video models),
- frame-by-frame timeline editing,
- auto-posting to social platforms,
- team collaboration,
- languages other than English.

## 6. User flows

### 6.1 First video (happy path)
1. **Landing:** type a prompt and click Generate.
2. **Sign in** with Google or an emailed link. The first sign-in creates the account, and you return to Create with the prompt filled in.
3. **Create:** pick an input mode, a format (vertical, square, wide), a length (30, 60, 90 seconds), a voice and a style. Then Generate.
   - **Topic:** "Why sleep matters for memory"
   - **Paste text:** an article, newsletter or notes to turn into a video
   - **Script:** your own narration, used as written 🗓️
4. **The job runs in the background** (🔜). You land on the video page with a progress bar showing these steps, and you can close the tab:
   - Researching (only when the prompt needs facts)
   - Writing the script
   - Planning scenes
   - Recording the voice
   - Rendering the video
5. **Preview:** the video plays in the browser. The script and sources (if any) are beside it.
6. **Edit** (🔜): change a scene's text, swap its type, reorder or delete scenes, change voice or style. Only the changed parts are regenerated.
7. **Export** (🔜): click Export MP4, watch the progress, then download.

### 6.2 Failure path
- **Research found nothing usable:** the video is made without data scenes, and the user is told why.
- **The plan fails validation twice:** the video is marked Failed and shows which checks failed, with Try again.
- **Voice or render step fails:** that step retries automatically, then shows a clear error with Retry, keeping everything that already succeeded.

### 6.3 Returning user
Dashboard → a recent video → edit, re-export or duplicate, or start a new prompt.

## 7. Screens

Visual style: dark UI, amber accent, Geist font, rounded cards. It should feel in the league of Higgsfield or Revid, but cleaner.

### 7.1 Landing ✅ (copy needs to go generic 🔜)
```
┌────────────────────────────────────────────────────────────────────┐
│ [P] PoliVid                              How it works  [Open app]  │
├────────────────────────────────────────────────────────────────────┤
│ Turn any idea into a                            ┌──────────────┐   │
│ polished short video.                           │   sample     │   │
│ Type a prompt. Get a narrated video…            │   video      │   │
│ ┌─────────────────────────────────────────┐     │   playing    │   │
│ │ What's your video about?                │     │              │   │
│ │                           [Generate →]  │     │ caption…     │   │
│ └─────────────────────────────────────────┘     └──────────────┘   │
│ (explain a concept) (article → video) (top 5 list) (data story)    │
├────────────────────────────────────────────────────────────────────┤
│ How it works: 1 Type a prompt · 2 Edit scenes · 3 Download MP4     │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 Sign in ✅
Centered card: **Continue with Google**, "or", an email field and **Email me a sign-in link**. Then a "Check your email" page. Errors show in plain language.

### 7.3 App shell ✅
- **Sidebar:** Dashboard, Create, My videos, Templates (soon), Settings (soon).
- **Sidebar footer:** plan card, then the user's avatar, name and email with sign-out.
- **Mobile:** a top bar with the same navigation.

### 7.4 Dashboard ✅ (stats go generic 🔜)
Prompt box at the top, stats (videos made, minutes rendered, exports), then a grid of recent videos.

### 7.5 Create ✅ (new options 🔜)
```
┌──────────┬──────────────────────────────────────┬──────────────────┐
│ sidebar  │ Create a video                       │ Preview of       │
│          │ [Topic] [Paste text] [Script 🗓️]     │ chosen style     │
│          │ ┌──────────────────────────────────┐ │                  │
│          │ │ prompt / pasted text…            │ │                  │
│          │ └──────────────────────────────────┘ │                  │
│          │ Format [▯ Vertical][□ Square][▭ Wide]│                  │
│          │ Length [30s][60s][90s]               │                  │
│          │ Voice  [Narrator ▾] [▶ sample]       │                  │
│          │ Style  [Bold][Minimal][Editorial]    │                  │
│          │ [        Generate video →          ] │                  │
└──────────┴──────────────────────────────────────┴──────────────────┘
```

### 7.6 Video page ✅ (live progress, editing, export 🔜)
```
┌──────────┬─────────────────────────────────────────────────────────┐
│ sidebar  │ ← My videos                                             │
│          │ Why Sleep Matters for Memory                            │
│          │ 9:16 · 60s · Oct 14                                     │
│          │ ┌────────────┐  ┌ Scenes ─────────────────────────────┐ │
│          │ │            │  │ 1 Hook · 4s     "You forget 70%…" ✎ │ │
│          │ │   video    │  │ 2 Big number · 6s               ✎   │ │
│          │ │  preview   │  │ 3 List · 12s                    ✎   │ │
│          │ │            │  │ …                     [+ Add scene] │ │
│          │ └────────────┘  └─────────────────────────────────────┘ │
│          │ [⬇ Export MP4]  ┌ Sources (if any) ───────────────────┐ │
│          │ ▓▓▓▓▓▓░░ 64%    │ …                                   │ │
│          │                 └─────────────────────────────────────┘ │
└──────────┴─────────────────────────────────────────────────────────┘
```
- **While a job runs (🔜):** the player area shows the step list and a progress bar, refreshed every 2–3 seconds.
- **When it fails:** a red panel with the reason and Try again.

### 7.7 Settings 🗓️
Brand kit (logo, colors, font, intro/outro), default voice, default format.

### 7.8 Pricing and upgrade 🗓️
Decided after positioning. Stripe checkout, plan limits and a billing portal.

## 8. The video

| Property | Spec |
|---|---|
| Formats | 9:16 (1080×1920), 1:1 (1080×1080), 16:9 (1920×1080), 30 fps |
| Length | 30, 60 or 90 seconds; scene durations follow the narration |
| Scene types | ✅ Hook · Big number · Bars · Line · Quote · Sources. 🔜 Title/text · Bullet list · Comparison (A vs B) · Image (stock or upload) · Outro/CTA. 🗓️ Map · Timeline · Code/terminal · Screenshot/web page |
| On every scene | Progress bar, word-by-word captions, optional logo; source footer on data scenes |
| Styles | 🔜 3 built-in styles (Bold, Minimal, Editorial); brand kit 🗓️ |
| Free tier | Watermark and "Made with PoliVid" end card 🗓️ |
| Demo mode | "SAMPLE DATA" badge on every frame |
| Audio | AI narrator with several voices 🔜; background music 🔜; your own recorded narration 🗓️; AI voices of real people allowed (labeled as AI) |
| Media | Stock images/video (Pexels/Unsplash) 🔜; your own uploads 🗓️; AI-generated images 🗓️ |
| Export | MP4 (H.264) 🔜; C2PA "AI-generated" metadata 🗓️ |

## 9. Functional requirements

### 9.1 Generation
| # | Requirement | Status |
|---|---|---|
| G1 | Research with web search when the prompt needs facts; return facts with value, unit, period, source URL and verbatim sentence | ✅ |
| G2 | Return verbatim quotes with source URLs when relevant | ✅ |
| G3 | Plan scenes from the script, using `{fact_id}` placeholders for any numbers | ✅ |
| G4 | Deterministic validation: no raw numbers, known facts only, valid scene types and fields, one repair attempt | ✅ |
| G5 | Never double units ("29,000 jobs jobs") | ✅ |
| G6 | Generic prompts: topic, list, how-to, story and opinion videos that need no research | 🔜 |
| G7 | Paste-text input: turn an article or notes into a script of the chosen length | 🔜 |
| G8 | Run as a background job that survives closing the tab, with step and percentage saved to the database (Vercel Workflows) | 🔜 |
| G9 | Fetch each source page and confirm numbers and quotes appear in it | 🗓️ |
| G10 | Script input: use the user's own narration word for word | 🗓️ |
| G11 | URL input: turn a web page or Substack post into a video | 🗓️ |

### 9.2 Video, editing and export
| # | Requirement | Status |
|---|---|---|
| V1 | In-browser preview of the exact composition that will be exported | ✅ |
| V2 | AI voiceover per scene, with captions timed to the words | 🔜 |
| V3 | New scene types: title/text, bullet list, comparison, image, outro | 🔜 |
| V4 | Stock media search per scene (Pexels/Unsplash), chosen by the planner | 🔜 |
| V5 | 3 built-in styles | 🔜 |
| V6 | Background music track with ducking under narration | 🔜 |
| V7 | Scene editor: edit text, change type, reorder, delete, add; regenerate only what changed | 🔜 |
| V8 | MP4 export via Remotion on Vercel Sandbox, stored in Vercel Blob, with progress | 🔜 |
| V9 | Brand kit, media uploads, AI images | 🗓️ |
| V10 | Watermark and end card on the free tier; C2PA metadata | 🗓️ |
| V11 | Shareable public video page | 🗓️ |

### 9.3 Accounts, billing and admin
| # | Requirement | Status |
|---|---|---|
| A1 | Sign in with Google or an email magic link (Auth.js v5) | ✅ (needs credentials) |
| A2 | Database sessions; videos visible only to their owner | ✅ |
| A3 | Usage ledger: tokens, TTS characters, render seconds and dollars per video | 🔜 |
| A4 | Hard monthly AI spend cap | 🔜 |
| A5 | Stripe plans, limits and billing portal | 🗓️ (after positioning) |

## 10. Non-functional requirements
- **Reliability.**
  - Jobs retry failed steps and keep completed ones.
  - A crashed job leaves the video in a clear failed state.
  - The database is AWS RDS Postgres: always on, with 7-day backups.
- **Speed.** A 60-second video renders in under 5 minutes.
- **Cost.** ≤$0.50 per 60-second video all-in. Model choice is configurable (`POLIVID_MODEL`).
- **Security.**
  - Ownership is checked on every read and in every API route.
  - The database is reached over SSL as a limited app user.
  - Secrets live only in env files and Vercel env vars.
- **Privacy.** Prompts, scripts and videos are private to their owner unless shared.
- **Compliance.** AI-content labeling (principle 5) and preview before export (principle 6). Legal review before public launch.

## 11. Technical approach (summary)
- **App:** Next.js 16 on Vercel.
- **LLM:** OpenRouter, default `anthropic/claude-opus-5.5`.
- **Rendering:** Remotion for both preview and export.
- **Voice:** TTS provider with word timestamps (to be chosen; see section 14).
- **Auth:** Auth.js v5 (Google + Resend).
- **Database:** Prisma 6 on AWS RDS Postgres.
- **Background jobs:** Vercel Workflows 🔜.
- **Export:** Remotion on Vercel Sandbox to Vercel Blob 🔜.
- **Progress to the client:** the video page polls every 2–3 seconds.

Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## 12. Milestones

Estimates are in focused build days.

| Milestone | Scope | Estimate | Exit criteria |
|---|---|---|---|
| **M0 Skeleton** ✅ | Landing, auth, dashboard, create, in-request generation, preview, sources | Done | A data video passed validation |
| **M1 Generic generation** | G6, G7, V3, generic landing and dashboard copy | ~1 day | 10 non-data prompts produce sensible previews |
| **M2 Background jobs** | G8 + live progress; Vercel project linked | ~1 day | Close the tab mid-generation and come back to a finished video |
| **M3 Voice + export** | V2, V6, V8, A3, A4 | 1–2 days | Download a narrated MP4 with captions and music |
| **M4 Look and media** | V4, V5 | ~1 day | 7 of 10 test videos are good enough to post |
| **M5 Editing** | V7 | 1–2 days | Fix one bad scene without regenerating the rest |
| **M6 Position and launch** | Pick the niche, pricing, Stripe (A5), brand kit, legal review | After M5 | Decided after dogfooding |

## 13. Decisions log
| Date | Decision | Why |
|---|---|---|
| 2026-10-14 | Wedge: data-driven news and politics | Daily need, monetized creators, accuracy matters most |
| 2026-10-14 | **Wedge paused. Build a generic, fully working video generator first** | Get the core product working end to end, then choose a niche from what it does well |
| 2026-10-14 | Real people allowed in videos (labeled when AI-generated) | Common practice; founder's call |
| 2026-10-14 | OpenRouter for LLM calls | Founder's choice; switch models without code changes |
| 2026-10-14 | The AI writes placeholders, code writes numbers | The only way to guarantee "never invent a number" |
| 2026-10-14 | Auth.js v5, Google + Resend | Native to the App Router; built-in Resend provider |
| 2026-10-14 | Postgres on AWS RDS, not Neon or Mongo | Neon was unreliable in the founder's experience; ~$18/mo is fine |
| 2026-10-14 | No real-time service for v1; poll every 2–3 seconds | Status lives in the database, so pub/sub can be added later |
| 2026-10-14 | Name PoliVid; domain polivid.io for now | Working name; may change after positioning |
| Pending | Vercel Workflows + Remotion on Vercel Sandbox (no Lambda) | Keeps everything on Vercel. `@remotion/vercel` is experimental; Remotion Lambda is the fallback |

## 14. Open questions
1. **Niche and name:** which use case to focus on after v1 works. "PoliVid" fits politics, so the name probably changes too.
2. **Voice provider:** ElevenLabs (best quality, word timestamps) vs OpenAI or Google (cheaper). TTS needs its own key, since OpenRouter covers text models only.
3. **Stock media:** Pexels and Unsplash are free with attribution rules. Is that enough, or add a paid library?
4. **Music:** a royalty-free library bundled with the app, or a licensed API?
5. **Budget:** the real monthly budget sets the AI spend cap.
6. **Vercel:** create and link the project (needed for Workflows, Sandbox and Blob), and check Sandbox and Blob pricing.
7. **Demo mode in production:** keep it as a logged-out "try it" experience, or remove it?
