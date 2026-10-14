# PoliVid plan

**Version:** 1, 2026-10-14. **Horizon:** 90 days, Oct 14, 2026 to Jan 12, 2027.
**Constraints:** solo founder, 12–20 hours a week, assumed budget of $100–300/month (not confirmed), first video project.

**One line:** PoliVid turns today's political and economic numbers into a short video you can stand behind. Every figure on screen is pulled from a source and cited. Tagline: *News videos with receipts.*

**How claims are tagged**
- **[F]** fact, with the source in brackets or in the Sources list at the end.
- **[E]** estimate, with the reasoning shown.
- **[G]** guess or judgment call.
- **[UNVERIFIED]** a claim the research couldn't confirm.

None of this is legal advice. Section 8 recommends a short legal review before launch.

---

## 0. The decisions this plan rests on

| # | Decision | Status |
|---|---|---|
| 1 | Standalone company, not a WriteStack add-on | Your call, locked |
| 2 | Wedge: data-driven news and politics shorts for independent creators | Your call, locked 2026-10-14 |
| 3 | Build first, with no interview or research phase | Your call, locked |
| 4 | Visuals are drawn with code (Remotion). No AI-generated footage, avatars, or likenesses of real people | Recommended (section 4) |
| 5 | The LLM picks facts and arranges scenes. Code computes and draws every number | Recommended. This is the core of the product (section 4) |
| 6 | No pre-launch research, but a scoreboard with go / change / stop thresholds | Recommended (section 5) |

---

## 1. Customer and problem

### Who it's for

**Primary customer [G]:** independent news and political commentators who:
- publish at least 3 times a week,
- have an audience of 2k–200k,
- earn from paid subscriptions, Patreon, or ad revenue,
- already use numbers: polls, the economy, votes, budgets, court rulings.

They live on Substack (which you can reach through WriteStack), YouTube, TikTok, Instagram, and X.

**How big this is:**
- **Large news influencers.** Pew counted 2,058 US news influencers with 100k+ followers. 77% never worked at a news organization, and 59% make money from subscriptions, donations, or merchandise. 21% of US adults regularly get news from them **[F: Pew, 2024-11-18]**.
- **The smaller long tail.** Below 100k followers there are probably 5–10× as many: roughly 10–20k US creators posting political or news video **[G]**.
- **Substack.** It said politics and news subscribers were on track to more than double in 2024, and the number of politics writers earning $1M+ doubled **[F, secondary: Axios 2024-08-13, search snippet]**. Substack doesn't publish politics' share of the platform **[UNVERIFIED]**.

**Start with buyers who can earn from the videos.** TikTok doesn't let political accounts monetize **[F: TikTok newsroom, Sep 2022]**. Start with creators whose main platform is Substack or YouTube, and treat TikTok as a place to post, not a market to sell to **[E]**.

**Secondary customers, after day 90:**
- creator media teams of 2–20 people that already pay editors for motion graphics. For example, More Perfect Union is hiring a $90k editor with After Effects skills to make policy explainers **[F: Built In job listing, ~Sep 2026]**. These teams can pay more, and PoliVid saves their editors hours.
- small digital newsrooms and local outlets,
- economics and finance creators,
- policy newsletters.

**Not in v1:**
- **Campaigns, PACs, and paid political ads.** They bring disclosure rules and the risk of the brand being seen as partisan **[G]**.
- **Faceless channels in general.** That market is crowded and low-paying, and Revid already serves it **[F: revid.ai/ai-instructions.md]**.

### Jobs to be done

| When… | I want to… | So that… |
|---|---|---|
| A poll, jobs report, CPI print, vote, or ruling drops | publish a clean video about it within the hour | I'm early in the feed and get the views |
| I make a claim with numbers | show exactly where each number came from | my audience, and my critics, can check it |
| I've written an analysis | turn it into a 45–90s vertical video | I grow on YouTube, TikTok, and Notes without filming myself |

### What they do today

| Alternative | Cost | Weakness |
|---|---|---|
| Talking-head video with chart screenshots | Free, 30–60 minutes **[G]** | Looks amateur, and the numbers are hard to read on a phone |
| Canva or Flourish plus a screen recording | $0–18/mo **[F: Flourish pricing, Canva via research]** | Slow. Flourish only exports video on its Enterprise plan **[F: flourish.studio/pricing]** |
| Fiverr editor | $50–200 per clip **[F: Fiverr gig snippets via research]** | Takes days, so it misses the news cycle |
| In-house editor (larger outfits) | ~$90k/yr salary **[F: job listing]** | Expensive; graphics are the slow part of each video **[G]** |
| Custom motion-graphics studio | $1,000–8,000 per explainer **[F: contra.com listings]** | Far too expensive for daily use |
| Revid, InVideo, Higgsfield | $17–199/mo **[F]** | No data engine. Chart visuals are generated images, so the numbers can be invented **[F: InVideo help post; Revid data-viz page via research]** |

### Why they'd switch and pay [G]

- **Speed:** input to finished MP4 in under 10 minutes, on the day the news breaks.
- **Trust:** a visible source for every number. In politics, a wrong number gets screenshotted and dunked on.
- **Look:** newsroom-grade graphics without a graphics desk.

They pay because more video means more views and subscribers, and that turns into money. That's the same reason Revid's customers pay, and newsletter writers usually don't have it.

---

## 2. Competitive check

### What the research found (as of 2026-10-14)

| Player | What it does | Price | Gap for this wedge |
|---|---|---|---|
| **MotionVid** | Turns a CSV or PDF into a data video with AI narration | Free tier; $19/mo **[F: motionvid.ai]** | Closest product to ours. No accuracy claim, aimed at finance teams, no news workflow, rendering method not disclosed |
| **Alien Art Charts** | Chart races from CSV or Wikipedia, 4K MP4 | $19/mo **[F: alienart.io]** | No script and no narration |
| **Hera** (YC S25) | Turns a prompt into motion graphics drawn with code | Price not published **[F: YC page]** | General motion design. You paste data into the prompt, and nothing checks it |
| **Higgsfield** Explainer and Vibe Motion | Turns a script into a narrated explainer. Vibe Motion uses Claude to write motion-graphics code | From $17.40/mo **[F: SiliconANGLE 2026-02-05]** | Explainer styles appear to be diffusion-generated **[E]**. No source binding. $400M raised, so it could add this **[F: TNW 2026-08-17]** |
| **Synthesia** motion graphics | "Numbers become a chart" | All plans **[F: synthesia.io/updates]** | Aimed at corporate training. No data import, no accuracy claim |
| **HeyGen** | Avatars, plus HyperFrames (open source, turns HTML into MP4, 63k stars) | ~$29/mo **[UNVERIFIED]** | Avatar-first. No accuracy claim |
| **Revid** | Faceless shorts and UGC ads. Founder-reported $600–680k MRR, team of 4 **[F: founder's X posts, Feb and Apr 2026, not Stripe-verified]** | $39–199/mo **[F]** | No chart engine **[F]** |
| **Flourish (Canva)** | Accurate charts, election templates | Video export on Enterprise only **[F]** | Not a video product |
| **Wochit** | Template video at scale for publishers, in bulk from CSV or an API | From $999/mo **[F: wochit.com]** | Priced for publishers, not creators |
| **InVideo** | Prompt-to-video with stock and generated footage; markets "faceless political commentary" | $10–75 per seat/mo **[F]** | No data engine |
| **Nota VID** | Article-to-video for local newsrooms | Demo only **[F: heynota.com]** | Sold to newsrooms; not self-serve |
| **Datawrapper**, **270toWin** | Accurate charts, maps, election maps | Free–$39/mo **[F]** | No video export **[F]** |
| **Opus Clip** | Cuts long videos into captioned shorts | $0–29/mo **[F: opus.pro]** | Works alongside PoliVid: it clips a creator's show but doesn't make graphics |

### Gaps that are real

1. **Nobody markets numbers you can verify.** MotionVid, HeyGen, Synthesia, and Higgsfield make no claim about whether the numbers are right **[F: research, pages reviewed 2026-10-14]**. "Every number links back to a source" is open territory.
2. **Nobody builds for news-cycle speed.** I found no tool built around data-release days: a CPI print, jobs Friday, a Fed decision, polls. None of the news-video tools found pairs accurate data charts with video export at creator prices **[E: research]**.
3. **The hard part is reliability, not drawing.** One research paper found GPT-5 alone scored 2.13/5 at making data videos, and its generated code ran successfully only 48.6–86.2% of the time. Multi-step pipelines did better **[F, secondary: DataMagic paper, HKUST-GZ, 2026-09-27, via research]**. The defensible part is the verification pipeline, not the renderer.

### Where your original thesis is wrong

- **"Drawing with code" is not a moat.** Higgsfield already has Claude write motion-graphics code, HeyGen open-sourced an HTML-to-MP4 tool, and Remotion ships official AI agent skills **[F]**. You could build this in a weekend, and so can they.
- **"Precision video" as a general category has weak demand evidence.** Narrow "CSV to chart video" and "prompt to math animation" launches got 1–5 upvotes **[F: Product Hunt and HN via research]**. Vizzu, an animated data-story startup, got 13k beta signups but kept too few users, failed to raise its next round, and switched to services **[F: tech.eu 2025-08-28]**.
- **What could make it work:** pairing it with a buyer who has a **daily** need and earns money from video. News is that buyer. Your moat has to be:
  - the fact layer (connectors, verification, receipts),
  - speed on release days,
  - a trusted nonpartisan brand,
  - distribution through the watermark and a showcase channel.

  The renderer isn't part of the moat.

---

## 3. Positioning and pricing

**Positioning:** *For independent news and political creators who need to post every day, PoliVid makes 60-second data videos where every number is pulled from its source and cited on screen. Unlike Revid or Higgsfield, it never invents a number. Unlike Flourish or Canva, it's a finished video in minutes.*

### Subscription vs pay-per-video

**Recommendation: a subscription priced in videos, not credits.**
- News creators post daily, which suits a subscription.
- Your cost per video is predictable, so you can offer flat "videos per month." That sets you apart from the credit systems at Revid and Higgsfield **[F: Revid uses credits]**.
- Add a top-up pack for spikes like election night or a big ruling.

| Plan | Price/mo | Videos/mo | Includes |
|---|---|---|---|
| Free | $0 | 2 | 720p, PoliVid watermark and end card, AI voice |
| Starter | $19 | 10 | 1080p, no watermark, brand kit (logo, colors) |
| **Creator** | **$39** | **30 (about daily)** | Data-release templates, custom receipts page |
| Pro | $99 | 100 | Auto-drafts when data is released, your own voice, 2 seats |
| Top-up | $15 | +20 | For spike days |

**Pricing anchors:**
- Chart tools: $19/mo (MotionVid, Alien Art) **[F]**.
- Revid's entry plan: $39 **[F]**.
- A single Fiverr clip: $50+ **[F]**.

Creator at $39 costs less than one freelance clip a month.

### Unit economics [E]

The planning number is **$0.50 per video**, all-in. Section 4 shows the basis.

| Plan | Cost if every video is used | Margin | Cost at typical use (40%) [G] | Margin |
|---|---|---|---|---|
| Starter $19 | $5 | 74% | $2 | 89% |
| Creator $39 | $15 | 62% | $6 | 85% |
| Pro $99 | $50 | 49% | $20 | 80% |
| Free | $1 per user | — | ~$0.50 | — |

Stripe fees are about 3% on top.

**Targets [G]:**
- Blended ARPU (average revenue per paying user) of about **$40**.
- Day 90: 10 paying customers, about $400 MRR.
- Month 6: 100 paying, about $4k MRR.
- Month 12: 300 paying, about $12k MRR.

**Fixed costs [E]:** about $60–120/mo (Vercel Pro, Postgres, domain, ElevenLabs plan).

**Budget warning:**
- The free tier is your biggest cost risk. 500 active free users at about $0.60 each is about $300/mo, the top of the assumed budget.
- Cap free generations, require email verification, and set a hard monthly spend limit in the Anthropic console.
- **I need your real monthly budget to set the free-tier size.**

---

## 4. MVP scope and architecture

### The core principle: the LLM arranges, code computes

The LLM never writes a number and never writes rendering code. Instead:

1. **Facts come only from sources.** Each fact is a value plus a pointer to where it came from: a URL with an exact quote or selector, a FRED series and date, or a CSV cell.
2. **The LLM produces a scene plan.** This is a JSON document, validated against a schema, that lists prebuilt scene types and **references facts by id**. Narration uses placeholders, for example: `Inflation came in at {cpi_yoy} in September.`
3. **A deterministic linter rejects the plan** if:
   - it has any raw digit outside an allowed date pattern,
   - it references a fact that doesn't exist,
   - it quotes something that doesn't appear verbatim in the source, or
   - the scene durations don't add up.

   On failure, the LLM gets one repair pass.
4. **Formatters handle the classic political-number traps:**
   - percentage points vs percent,
   - year-over-year vs month-over-month,
   - seasonally adjusted vs not,
   - poll margin of error,
   - revised figures.
5. **Every video ends with a sources card** and gets a public **receipts page**: each source, its link, and when it was retrieved.

This is what lets you promise "never invents a number." It also avoids the failure rate that research found when a model writes rendering code directly.

### Built-in safeguards for platforms and the law

1. **A person approves every video.** The creator confirms the facts and previews the video before export. This gives them editorial responsibility, which is the exemption in EU AI Act Article 50(4) for AI-generated public-interest text **[F: artificialintelligenceact.eu]**. It also keeps PoliVid from becoming a "mass production" tool (see risk 2).
2. **Machine-readable AI marking on exports, from launch.**
   - Article 50(2) requires providers to mark synthetic audio, video, and text. It has applied since 2026-08-02.
   - The grace period to Dec 2, 2026 covers only systems that were on the market before Aug 2, 2026 **[F: Cloud Security Alliance, 2026-09-21; formal adoption UNVERIFIED]**.
   - The cost: marking (C2PA) can trigger Meta's "AI info" label **[F: Meta labels from C2PA/IPTC metadata]**.
3. **No realistic depictions or voices of real people.** That's what about 31 state election-deepfake laws and the platform disclosure rules target **[E: Public Citizen tracker, 2026-10-05]**.
   - YouTube exempts AI help with scripts and infographics **[F: YouTube help 14328491]**.
   - Never voice a politician's quote in a voice that sounds like them.
4. **Every video should look different.** Use creator branding, the creator's own voice, and varied layouts. That keeps customers clear of YouTube's rule against monetizing "templated," "mass-produced" AI content, which has applied since 2025-07-15 **[F: YouTube help 1311392]**.

### MVP scope

| In | Out (later or never) |
|---|---|
| 9:16 vertical, 30–90s | 16:9 and 1:1 (Phase 4) |
| Inputs: pasted table or CSV, URL (article, press release, poll page), FRED series | Licensed election-results and polling feeds |
| 8 scenes: Hook, Big Number (with change), Line, Bar/Ranking, Poll Bars (with margin of error), Quote Card (text only), Timeline, Sources + Outro | Maps (Phase 4), 3D, Manim, math |
| AI narration with word-timed captions; **recording your own narration (Phase 3)** | Voice cloning (later, your own voice only) |
| **Graphics-only export (Phase 4):** scene clips with no narration, for creators to drop into their own commentary videos | — |
| Scene-level edits: rewrite narration, reorder, delete, change chart type, brand kit | A frame-accurate timeline editor |
| In-browser preview, render on export | Auto-posting to social platforms |
| Receipts page | Avatars, AI-generated footage, photos of real people: **never in v1** |

### Pipeline

```
Browser (Next.js app, politi-vid)
  1. Input        topic + sources (URL / CSV / FRED series)
  2. Facts table  user confirms each fact and its source      <- the "receipts" step
  6. Preview      @remotion/player, runs in the browser at no render cost
  7. Export       request a render

Next.js API routes (Vercel), one short step per call, each persisted
  ingest   fetch URL / FRED API / parse CSV -> candidate facts
  verify   deterministic: value present in source, quote is verbatim
  plan     Claude Opus 5.5, structured output -> ScenePlan JSON (fact refs only)
  lint     no raw numbers, refs exist, quotes verbatim, timing -> 1 repair pass
  voice    TTS per scene + word timestamps -> captions
  render   Remotion Lambda (AWS) -> MP4 in S3 -> webhook -> DB

Postgres (Prisma): users, videos, sources, facts, scene_plans (versioned),
                   renders, usage_ledger (tokens, characters, $ per video)
Stripe | PostHog | Resend
```

There's no job queue in the MVP. Each step is a short API call, and Remotion Lambda renders asynchronously and calls back with a webhook. Add Inngest, Trigger.dev, or AWS EventBridge in Phase 4 for scheduled auto-drafts. You already use EventBridge Scheduler in WriteStack **[F: WriteStack package.json]**.

### Stack

| Layer | Choice | Why | Cost |
|---|---|---|---|
| App | Next.js 16 (this repo), Vercel | You already ship on it | $20/mo Pro **[E]** |
| Video | Remotion: Player for preview, Lambda for render | It's React, which you know. Free for companies of 3 or fewer people **[F: Remotion LICENSE]** | ~$0.02–0.05 per minute rendered **[F/E: remotion.dev cost example]** |
| LLM | Claude Opus 5.5 (`claude-opus-5-5`), structured outputs, prompt caching | Planning quality decides accuracy. Cached reads are $0.20 per 1M tokens | $4 / $20 per 1M tokens **[F: Anthropic pricing]** |
| Cheaper LLM (optional) | Sonnet 5.5 ($2 / $10) or Haiku 5.5 ($0.10 / $0.50) for extraction | Measure quality on the 20-video test set before downgrading | **[F]** |
| TTS | ElevenLabs Flash API, word timestamps for captions | Good voice quality. Swappable for OpenAI or Google if needed | $0.04 per 1k characters, about $0.036 per narrated minute **[F/E]** |
| Database | Postgres on AWS RDS (db.t4g.micro) + Prisma | Always on, no cold starts; Prisma like WriteStack | ~$18/mo **[E]** |
| Auth | Auth.js (NextAuth) | Same as WriteStack | $0 |
| Storage | S3 (Remotion's default output) | No extra integration | Cents |
| Payments, analytics, email | Stripe, PostHog, Resend | You already use all three | Usage-based |

### Cost per video

**Research ranges** (Remotion path, including about 2 LLM revisions and 1 re-render) **[E: research]**:
- 60s video: $0.07 low, **$0.58 likely**, $2.15 high.
- 3-minute video: $0.16 low, $1.50 likely, $5.40 high.

**This design at Opus 5.5, medium effort, 45–60s [E]:**

| Item | Cost |
|---|---|
| Planning (cached system prompt, ~5k dynamic input, ~6k output, ×1.5 for repairs) | $0.15–0.35 |
| Narration (×1.5 for regenerations) | $0.05 |
| Render (×2 for re-renders) | $0.06–0.10 |
| Storage | ~$0 |
| **Total** | **$0.30–0.50** |

The LLM is 75–85% of variable cost **[E: research]**, so prompt caching matters most.

---

## 5. Scoreboard (in place of a validation phase)

There's no research phase. These are product metrics you'll see in PostHog and Stripe anyway, decided in advance so sunk cost doesn't make the call. All thresholds are **[G]**.

| Checkpoint | Measure | Go | Change something | Stop or pivot |
|---|---|---|---|---|
| **Day 30, Nov 13** (engine) | 20 videos about real news that week | 0 wrong numbers; median input-to-MP4 under 10 min; ≤$0.60 per video | Any wrong number or a 20+ min median: fix the engine, don't launch | — (this tests the tech, not the market) |
| **Day 60, Dec 13** (alpha) | Alpha creators and the showcase channel | ≥10 creators made 3+ videos; ≥5 posted publicly with the watermark | 3–9 active creators: fix onboarding and templates | <3 of 20 invited creators make a second video: rethink the format |
| **Day 90, Jan 12** (payments) | Paying users, usage | ≥10 paying; ≥50% of payers make 8+ videos in month 1 | 3–9 paying: work on pricing and value | <3 paying with ≥300 signups: point the engine at another market |
| **Month 6, Apr 14, 2027** | MRR, churn | ≥$3k MRR and ≤10% monthly paid churn | $1–3k MRR: narrow the customer or the format | <$1k MRR: stop the standalone company |

**Pivot paths that reuse the engine** (the engine is the asset; the market is the bet):
1. Economics and finance creators.
2. Faceless data shorts.
3. A WriteStack feature for data-driven newsletters.

**Stop signals that override the table:**
- An accuracy incident traced to the engine, not to the user's data, that you can't make structurally impossible.
- A platform policy that demonetizes or throttles your customers' PoliVid videos. YouTube's "mass-produced content" rule is the one to watch (risk 2).

---

## 6. Go-to-market

### What WriteStack is for here

WriteStack is a door to **political writers**. It's not the showcase.
- Videos about Substack growth would be off-brand for a politics product.
- The showcase is **PoliVid's own channel**: a nonpartisan, numbers-only daily short ("CPI in 45 seconds," "Poll of the week," "What the jobs report actually says"). Post it to YouTube Shorts, TikTok, Instagram, X, and Substack Notes.
- Each video links to its receipts page and says "Made with PoliVid."

It's your demo, your test content and your marketing at once. It's also how you stop depending on Substack.

### First 10 paying customers (weeks 5–13)

1. **WriteStack politics writers.** Query the WriteStack database for users with politics or news publications (needs your OK to run). Send about 30 personal emails offering a free 3-month alpha in exchange for keeping the watermark and giving feedback.
2. **Direct outreach to 50 creators** who match the profile: 5k–100k audience, posting 3+ times a week, already using charts on Substack or YouTube. Offer to make their next video with them on a short call. That counts as onboarding, not research.
3. **Founder pricing:** Creator at $19/mo for life for the first 25 who pay.

### First 100 (weeks 9–26)

- **Watermark loop:** every free video carries the brand.
- **Data-release-day marketing:** on CPI day, jobs Friday, and Fed days, post the video within 15 minutes with "made in 4 minutes." Build template landing pages for each release (also good for SEO).
- **Affiliate program:** 30% recurring for 12 months. You already run partner and affiliate pages at WriteStack **[F: WriteStack git log]**.
- **Launches:**
  - Product Hunt.
  - Show HN with the "never invents a number" angle.
  - WriteStack email and an in-app banner.
  - Your own Substack Notes and X.
- **Substack politics:** big and growing.
  - Politics subscribers were on track to more than double in 2024 **[F, secondary: Axios]**.
  - The Free Press had 1.5M subscribers, 170k+ of them paid, when Paramount bought it for about $150M **[F: NBC News, 2025-10-06]**.
  - Your buyers are the long tail below publications like that. 82% of Substack's top 250 earners already post audio or video **[F: Digiday, 2025-03-14]**.
- **Expect early adopters to lean toward whichever side is out of power.** After the 2024 election, left-leaning news channels' YouTube views rose 25.6% while right-leaning ones fell 10.1% **[F: Pixability, 2025-05-19]**. Keep the showcase strictly nonpartisan anyway; that's the brand.

---

## 7. 90-day roadmap: phases and weekly milestones

> **Update, 2026-10-14:** Building went much faster than these week estimates. The app skeleton (landing page, auth, dashboard, prompt-to-video generation, preview) was built in one day; see [ARCHITECTURE.md](ARCHITECTURE.md). Treat the build weeks below as shortened. The go-to-market weeks and the scoreboard gates still apply, because they depend on real users, not on code.

The hour estimates assume about 15 hours a week and total about 200 hours **[E]**. It's your first video project, so expect the plan to slip by 20–30%; Phase 4 is the buffer **[G]**.

### Phase 0: Spike (week 1). Can I make one good video?
**Exit:** a 45s vertical MP4 of real CPI data that you'd actually post.

### Phase 1: Engine (weeks 2–4). Facts in, accurate video out
**Exit:** the Day 30 gate.

### Phase 2: Private alpha (weeks 5–7). Real creators, real posts
**Exit:** the Day 60 gate.

### Phase 3: Public beta and payments (weeks 8–10). People can pay
**Exit:** launched, with paying users coming in.

### Phase 4: Retention and buffer (weeks 11–13). Reasons to come back daily
**Exit:** the Day 90 review.

| Wk | Dates | Phase | Milestone (definition of done) | Hrs |
|---|---|---|---|---|
| 1 | Oct 14–20 | 0 | Remotion added to this repo (read the Next 16 docs first, per AGENTS.md). One hardcoded composition (Hook, Big Number, Line, Sources) renders locally from a real FRED CPI pull, with ElevenLabs narration and captions. Buy polivid.io | 15 |
| 2 | Oct 21–27 | 1 | **Fact layer:** CSV/paste parser, FRED connector, URL fetch plus extraction with verbatim verification. Facts table UI with a confirm step. ScenePlan schema v1 | 15 |
| 3 | Oct 28–Nov 3 | 1 | **Planner and linter:** Opus 5.5 structured output, then the linter, with one repair pass. All 8 scenes plus the theme system. Election week: collect real test cases, don't launch | 18 |
| 4 | Nov 4–10 | 1 | **Voice, preview, render:** TTS per scene with timestamps and captions, `@remotion/player` preview, Remotion Lambda render with webhook to S3. Build the 20-video test set from that week's news | 18 |
| — | **Nov 13** | Gate | **Day 30:** 0 wrong numbers in 20 videos, median under 10 min, ≤$0.60 per video | — |
| 5 | Nov 11–17 | 2 | Auth, Postgres/Prisma, video list, usage ledger. **Showcase channel starts posting daily** | 15 |
| 6 | Nov 18–24 | 2 | Editor: edit narration (re-linted), reorder or delete scenes, change chart type, brand kit, re-render. **Invite 20 alpha creators** | 15 |
| 7 | Nov 25–Dec 1 | 2 | Receipts page. Templates: CPI, jobs report, Fed decision, Poll of the week, Bill breakdown. Fix what alpha users hit (Thanksgiving week, so lighter) | 12 |
| 8 | Dec 2–8 | 3 | Stripe plans, free tier with watermark and limits, hard spend caps, **machine-readable AI marking (C2PA) on exports**, landing page on polivid.io. **One-hour legal review before launch** | 16 |
| 9 | Dec 9–15 | 3 | **Public launch:** WriteStack email, Product Hunt, Show HN, Notes, X. Affiliate program live | 15 |
| — | **Dec 13** | Gate | **Day 60:** alpha creators and showcase-channel numbers | — |
| 10 | Dec 16–22 | 3 | **Your own narration:** record in the browser, with captions from speech-to-text timestamps. This is the main defense against YouTube's mass-production rule. Upgrade prompts at limits | 16 |
| 11 | Dec 23–29 | 4 | Holiday week, so plan light: **graphics-only export** (scene clips with no narration), buffer, fixes | 6 |
| 12 | Dec 30–Jan 5 | 4 | **Auto-drafts:** follow FRED/BLS series, and a draft video is ready when new data lands (scheduler) | 15 |
| 13 | Jan 6–12 | 4 | Activation emails through Resend, 16:9 export, fix the top 5 issues. **Day 90 review: go, change, or pivot** | 15 |

**After day 90, if the scoreboard says go:**
- US state map scene,
- cloning the creator's own voice (only their own),
- licensed polling and election-results data,
- team seats and a newsroom tier,
- Spanish,
- an API.

---

## 8. Risks and assumptions, ranked

| # | Risk or assumption | Likelihood × impact | How to test it | Mitigation |
|---|---|---|---|---|
| 1 | **Creators won't pay.** A talking head with screenshots is "good enough" | High × High **[G]** | Day 90 paid count; whether alpha users still make videos in week 3 | Speed and receipts as the pitch; Creator plan cheaper than one Fiverr clip |
| 2 | **YouTube demonetizes the videos.** Since 2025-07-15, YouTube doesn't monetize AI content made with "generic or unoriginal templates" that gives "the impression of mass production" **[F: YouTube help 1311392]** | Medium × High for YouTube-first customers **[E]** | Ask alpha creators with monetized channels to report any limited-ads or YouTube Partner Program warnings | The creator's own narration (week 10), graphics-only export for their own videos (week 11), varied layouts and branding, no auto-publishing |
| 3 | **Incumbents ship verified data video.** Higgsfield, Hera, and Synthesia already draw with code **[F]** | Medium × High | Check their changelogs monthly | Go deep where they won't: news data connectors, receipts, release-day speed, a nonpartisan trust brand |
| 4 | **An accuracy incident.** One wrong number in a viral political video ends the brand | Medium × Very high | Day 30 gate; an adversarial test set (pp vs %, revisions, seasonal adjustment, unit traps) | The "LLM arranges, code computes" contract, verbatim quote checks, receipts |
| 5 | **Labels and law.** Meta may treat realistic TTS as "realistic audio" and auto-label it **[E]**. About 31 states have election-deepfake laws, aimed at realistic depictions of people **[E: Public Citizen tracker]**. EU AI Act Article 50 applies to a new product from day one **[F]**. A New York bill would extend coverage to text **[F: NY A10715]** | Low–Medium × High | One-hour legal review before launch (~$300–500 **[G]**); post showcase videos on each platform in Phase 2 and watch the labels | The safeguards in section 4: human approval, C2PA marking, no real-person voices or likenesses, sources on screen. Market to the US first |
| 6 | **Misuse and brand capture.** Users make misleading but technically accurate videos | Medium × Medium | Review a sample of public videos weekly | Terms of service, sources on screen, nonpartisan showcase, no campaigns or PACs in v1 |
| 7 | **Churn.** AI apps keep 21.1% of subscribers after a year, vs 30.7% for non-AI apps **[F: RevenueCat 2026 via TechCrunch]** | High × Medium | Month-1 and month-2 paid retention | Auto-drafts on data releases build a daily habit; templates |
| 8 | **Seasonality.** You launch into the post-election trough. Silver Bulletin's paid subscriptions fell 27% in 2025 vs 2024 **[F: natesilver.net, 2025-12-31]**. MSNBC lost about half its audience the week after the 2024 election **[F: NewscastStudio, 2025-01-29]** | High × Medium | Compare December signups with February | Lead with economic data, which is year-round. The 2028 invisible primary likely starts in Q1–Q2 2027 **[G]**; the general election is 2028-11-07 **[F]** |
| 9 | **Founder bandwidth.** First video project, and WriteStack still needs you | Medium × High | Weekly hours actually logged vs plan | Phase gates; Phase 4 is the buffer |
| 10 | **Data licensing** for polls and election results | Medium × Medium | Check the terms before adding any feed | MVP uses user-supplied URLs plus FRED (check FRED's terms) |
| 11 | **Free-tier cost blows the budget** | Medium × Medium | Daily cost from the usage ledger | 2 free videos a month, verification, a hard API spend cap |

**What would make me recommend pivoting:**
- At day 90, signups are healthy (300+) but fewer than 3 people pay. The engine works, so point it at a buyer who already pays (economics and finance creators, or newsletter writers).

**What would make me recommend stopping:**
- At month 6, MRR is under $1k.
- Or an accuracy problem can't be made structurally impossible.
- Or platforms throttle political AI video enough that your customers' reach collapses.

---

## 9. The three decisions to make this week

1. **Lock the engine contract** (section 4): the LLM writes scene plans that reference facts, and code computes and draws every number. Remotion only. This decision drives the schema, the linter, and everything built in weeks 2–4.
2. **Draw the brand boundary before the showcase channel posts anything.**
   - Be nonpartisan and numbers-first.
   - No AI likenesses or voices of real people.
   - No campaign or PAC customers in v1.
   - A person approves every video, and nothing auto-publishes. That keeps customers eligible for YouTube monetization and covers EU AI Act Article 50(4).

   These are cheap to decide now and expensive to reverse after the first viral video.
3. **Set the money limits.** Tell me your real monthly budget. That sets the free-tier size (2 videos/month is the default here) and the hard API spend cap. Also: the product was renamed **PoliVid** on 2026-10-14, with **polivid.io** as the domain for now. polivid.io and polivid.com show as registered; polivid.ai and polivid.app were available **[F: Vercel domain registry check, 2026-10-14]**.

---

## Sources

Retrieved 2026-10-14 unless dated otherwise. The research agents' full reports are summarized above.

**Funding and market:**
- Higgsfield Series B: [TNW, 2026-08-17](https://thenextweb.com/news/higgsfield-series-b-400m-5-4bn-valuation-700m-revenue).
- Sora shutdown: [OpenAI Help Center](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation) and [The Decoder](https://the-decoder.com/openai-sets-two-stage-sora-shutdown-with-app-closing-april-2026-and-api-following-in-september/).
- Revid MRR (founder self-reports): x.com/tibo_maker/status/2024068923256168688 (2026-02-18) and x.com/tibo_maker/status/2045460847833551084 (2026-04-18).
- Revid customers and pricing: revid.ai/ai-instructions.md.

**Competitors:**
- motionvid.ai; alienart.io; [flourish.studio/pricing](https://flourish.studio/pricing); [Hera on YC](https://www.ycombinator.com/companies/hera-video); synthesia.io/updates.
- Higgsfield Vibe Motion: [SiliconANGLE, 2026-02-05](https://siliconangle.com/2026/02/05/higgsfield-launches-vibe-editor-creating-motion-graphics/).
- Vizzu: [tech.eu, 2025-08-28](https://tech.eu/2025/08/28/from-open-source-curiosity-to-boardroom-tool-vizzus-bid-to-make-data-stories-as-easy-as-slides/).
- Kodisc: kodisc.com/pricing.
- DataMagic (HKUST-GZ, 2026-09-27), via the research agent; I didn't capture its URL.

**Demand and retention:**
- AI app retention: [TechCrunch on RevenueCat, 2026-03-10](https://techcrunch.com/2026/03/10/ai-powered-apps-struggle-with-long-term-retention-new-report-shows).
- Substack video: [TechCrunch, 2025-02-20](https://techcrunch.com/2025/02/20/substack-now-lets-creators-monetize-videos-and-post-them-directly-from-its-app), [Substack live video](https://on.substack.com/p/live-video-is-available-to-all-publishers), [Digiday, 2025-07-02](https://digiday.com/media/substacks-video-bet-could-be-a-growth-hack-for-small-creators/).
- Freelance rates: Fiverr gig snippets; [Contra](https://contra.com/s/q3YmelEQ-motion-explainer-video-clear-in-30-or-60-seconds).

**Costs:**
- Claude pricing: platform.claude.com/docs/en/about-claude/pricing, plus Anthropic's model table cached 2026-10-06.
- ElevenLabs: elevenlabs.io/pricing/api.
- Remotion: [Lambda cost example](https://www.remotion.dev/docs/lambda/cost-example), [license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), remotion.pro/license.
- Cloudflare R2: [pricing](https://developers.cloudflare.com/r2/pricing/).

**News creators, policy, and seasonality:**
- Creators and market size:
  - [Pew, America's news influencers, 2024-11-18](https://www.pewresearch.org/journalism/2024/11/18/americas-news-influencers/)
  - Axios on Substack politics, 2024-08-13 (search snippet only)
  - [NBC News on the Free Press deal, 2025-10-06](https://www.nbcnews.com/business/business-news/paramount-cbs-news-acquires-free-press-bari-weiss-rcna220672)
  - [Digiday on Substack live video, 2025-03-14](https://digiday.com/media/how-substack-creators-are-pooling-audiences-with-live-video-co-hosting/)
  - More Perfect Union editor listing, builtincolorado.com/job/video-editor/11333583
- Tools: wochit.com; invideo.io; opus.pro; heynota.com; datawrapper.de; 270towin.com.
- YouTube:
  - [Altered or synthetic content disclosure](https://support.google.com/youtube/answer/14328491)
  - [Monetization policies, inauthentic content](https://support.google.com/youtube/answer/1311392)
- Meta: [manipulated media policy](https://transparency.meta.com/policies/community-standards/manipulated-media/).
- TikTok political-account monetization: TikTok newsroom, Sep 2022.
- State laws: [Public Citizen deepfake-election tracker, updated 2026-10-05](https://www.citizen.org/article/tracker-legislation-on-deepfakes-in-elections/).
- EU AI Act: [Article 50](https://artificialintelligenceact.eu/article/50/).
- Seasonality:
  - [Silver Bulletin year in review, 2025-12-31](https://www.natesilver.net/p/the-silver-bulletin-year-in-review)
  - NewscastStudio, 2025-01-29
  - Pixability, 2025-05-19
