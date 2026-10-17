import { ArrowRight, BarChart3, FileText, Mic, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CreditExamples } from "@/components/billing/credit-examples";
import { PricingCards } from "@/components/billing/pricing-cards";
import { TopupPacks } from "@/components/billing/topup-packs";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CardLink, Reveal, Rise, Stagger } from "@/components/motion/motion";
import { HeroStyles, StylePoster } from "@/components/style-frame";
import { buttonVariants } from "@/components/ui/button";
import { SHOWCASE, showcaseHref, showcaseMeta } from "@/lib/showcase";
import { GENERATION_MODELS } from "@/lib/video/models";
import { cn } from "@/lib/utils";

const TOOLS = [
  {
    icon: Sparkles,
    tint: "bg-primary/10 text-primary",
    title: "Topic to video",
    body: "One line in, a scripted explainer out.",
    href: "/create?input=topic",
    example: "“Why sleep matters for memory.”",
  },
  {
    icon: FileText,
    tint: "bg-glow/15 text-indigo-300",
    title: "Article to video",
    body: "Paste a newsletter or post. PoliVid writes a 30, 60, or 90-second script from it.",
    href: "/create?input=article",
    example: null,
  },
  {
    icon: BarChart3,
    tint: "bg-hot/15 text-pink-300",
    title: "Data story",
    body: "Charts drawn from sourced numbers, with a source footer on every data scene.",
    href: "/create?input=data",
    example: null,
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Describe it",
    body: "A topic, pasted text, or notes. Pick format, length, and style.",
  },
  {
    n: "02",
    title: "Script and scenes",
    body: "PoliVid writes the narration and plans each scene. Numbers come only from sourced facts.",
  },
  {
    n: "03",
    title: "Preview it",
    body: "Watch every scene in the browser. Editing one scene at a time is next.",
  },
  {
    n: "04",
    title: "Export and post",
    body: "A captioned preview for Shorts, TikTok, Reels, LinkedIn, and Substack. MP4 export is next.",
  },
] as const;

const STATS = [
  { value: "3", label: "formats, from 9:16 to 16:9" },
  { value: "3", label: "styles, Bold is live today" },
  { value: "0", label: "invented numbers on screen" },
  { value: "1", label: "prompt to a watchable preview" },
] as const;

const FAQ = [
  {
    q: "Does it make up numbers?",
    a: "No. When a video uses figures, they come from a fact list with sources. A script that types its own number is rejected before anything renders.",
  },
  {
    q: "Can I fix one scene?",
    a: "You can preview every scene today. Changing one line, swapping a scene type, or reordering is the next editing step.",
  },
  {
    q: "Is the video labeled as AI?",
    a: "You preview and approve every video before it leaves the app, and nothing auto-posts. An AI label in the export file ships with MP4 export.",
  },
  {
    q: "What does it cost?",
    a: "New accounts get 100 free credits, no card required. Starter is $19/month for 800 credits, Growth is $39/month for 2,000, and Ultra is $199/month for 12,000. Yearly billing is about 16% less. A typical 30-second Wan 720p video costs 300 credits.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Plan credits reset to your plan amount each month and do not stack. Credit boosts and leftover trial credits never expire.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from Billing. Your plan stays active until the end of the period you paid for, and you keep the videos you made.",
  },
] as const;

function SectionHeading({
  eyebrow,
  title,
  center = false,
  children,
}: {
  eyebrow: string;
  title: string;
  center?: boolean;
  children?: ReactNode;
}) {
  return (
    <Reveal className={cn("flex flex-col gap-3", center && "items-center text-center")}>
      <p className="font-label text-[11px] font-bold tracking-[0.22em] text-primary uppercase">{eyebrow}</p>
      <h2 className="text-3xl font-bold text-balance sm:text-5xl">{title}</h2>
      {children}
    </Reveal>
  );
}

const TILE =
  "rounded-2xl border border-white/[0.06] bg-card/60 p-5 transition hover:border-white/15 hover:bg-card";

export default function LandingPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-grid" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 left-1/2 h-[560px] w-[min(980px,140vw)] -translate-x-1/2 bg-[radial-gradient(closest-side,oklch(0.38_0.18_294/0.55),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[420px] left-1/2 h-[360px] w-[min(720px,120vw)] -translate-x-1/2 bg-[radial-gradient(closest-side,oklch(0.42_0.2_300/0.22),transparent)]"
      />
      <SiteHeader />

      <main id="main" className="relative">
        <section className="px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-24">
          <Rise className="mx-auto flex max-w-3xl flex-col items-center gap-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-label text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_2px] shadow-primary/60" aria-hidden />
              Built for people who explain things
            </span>
            <h1 className="text-5xl leading-[0.98] font-bold text-balance sm:text-7xl">
              Turn any idea into a <span className="text-primary">polished short video.</span>
            </h1>
            <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
              Type a prompt or paste an article. PoliVid writes the script, plans the scenes, and renders a
              captioned preview with crisp motion graphics. Every scene is on screen before you post.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full px-6 text-base glow-accent")}>
                Try for free
                <ArrowRight data-icon="inline-end" />
              </Link>
              <a
                href="#showcase"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-12 rounded-full px-6 text-base glow-ring hover:bg-glow/15",
                )}
              >
                Watch examples
              </a>
            </div>
            <p className="font-label text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              No credit card required · 100 free credits
            </p>
          </Rise>
          <HeroStyles />
          <p className="mt-8 text-sm text-muted-foreground">
            Three built-in styles. Bold is what videos look like today. Minimal and Editorial are next.
          </p>
        </section>

        <section aria-label="Video models" className="border-y border-white/[0.06] bg-white/[0.015] px-4 py-7 sm:px-6">
          <p className="text-center text-xs text-muted-foreground">Generation models available in PoliVid</p>
          <ul className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {GENERATION_MODELS.map((model) => (
              <li key={model.id} className="font-label text-lg font-medium tracking-tight text-foreground/45">
                {model.name}
              </li>
            ))}
          </ul>
        </section>

        <section id="tools" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="Start from a tool" title="Pick the input you have." />
            <Stagger inView className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TOOLS.map(({ icon: Icon, tint, title, body, href, example }) => (
                <CardLink key={title} href={href} className={cn(TILE, "group flex h-full flex-col gap-3")}>
                  <span className={cn("grid size-10 place-items-center rounded-xl", tint)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-semibold">{title}</span>
                  {example && <span className="text-sm text-muted-foreground">{example}</span>}
                  <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Try it
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </CardLink>
              ))}
              <div key="script" className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/10 p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Mic className="size-4" aria-hidden />
                </span>
                <span className="flex items-center gap-2 font-semibold">
                  Script to video
                  <span className="rounded-md bg-hot px-1.5 py-0.5 font-label text-[10px] font-bold tracking-wide text-white uppercase">
                    Soon
                  </span>
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  Bring your own narration, used word for word. Record it or upload it.
                </span>
              </div>
            </Stagger>
          </div>
        </section>

        <section id="showcase" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading eyebrow="Showcase" title="Made with PoliVid." />
              <p className="max-w-xs text-sm text-muted-foreground">
                Each one opens Create with the prompt and settings prefilled.
              </p>
            </div>
            <Stagger
              as="ul"
              item="li"
              inView
              className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
              itemClassName="flex flex-col gap-3"
            >
              {SHOWCASE.map((video) => (
                <div key={video.title} className="flex flex-col gap-3">
                  <StylePoster style={video.style} title={video.title} className="ring-1 ring-white/[0.06]" />
                  <p className="text-xs text-muted-foreground">{showcaseMeta(video)}</p>
                  <Link
                    href={showcaseHref(video)}
                    className={cn(buttonVariants({ variant: "outline" }), "h-9 rounded-full")}
                  >
                    Create similar
                  </Link>
                </div>
              ))}
            </Stagger>
          </div>
        </section>

        <section id="how" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="How it works" title="Prompt to preview in four steps." />
            <Stagger
              as="ol"
              item="li"
              inView
              className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              itemClassName={TILE}
            >
              {STEPS.map((step) => (
                <div key={step.n}>
                  <span className="font-heading text-4xl font-extrabold text-transparent [-webkit-text-stroke:1px_var(--primary)]">
                    {step.n}
                  </span>
                  <p className="mt-4 font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </Stagger>
            <dl className="mt-12 grid gap-6 border-t border-white/[0.06] pt-10 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="border-l-2 border-primary pl-4">
                  <dt className="font-heading text-4xl font-bold">{stat.value}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-10">
            <SectionHeading eyebrow="Pricing" title="Credits for the videos you actually make." center>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Start with 100 free credits. Subscribe when you need more. Unused boost credits never expire.
              </p>
            </SectionHeading>
            <PricingCards mode="marketing" />
            <TopupPacks />
            <CreditExamples />
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="FAQ" title="Questions, answered." />
            <Stagger as="dl" inView className="mt-10 grid gap-3 sm:grid-cols-2" itemClassName={TILE}>
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="px-4 pt-8 pb-24 sm:px-6">
          <Reveal className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-card px-6 py-16 text-center sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_15%_100%,oklch(0.36_0.18_294/0.6),transparent),radial-gradient(50%_70%_at_90%_0%,oklch(0.42_0.2_310/0.35),transparent)]"
            />
            <span className="relative rounded-md bg-primary/15 px-2 py-0.5 font-label text-[11px] font-bold tracking-[0.16em] text-primary uppercase">
              100 free credits
            </span>
            <h2 className="relative font-label text-4xl leading-none font-bold tracking-tight text-balance uppercase sm:text-6xl">
              Your next explainer
              <span className="block text-foreground/50">is one prompt away</span>
            </h2>
            <p className="relative max-w-md text-sm text-pretty text-muted-foreground sm:text-base">
              Preview every scene before anything leaves the app.
            </p>
            <Link
              href="/create"
              className={cn(buttonVariants({ size: "lg" }), "relative h-12 rounded-full px-6 text-base glow-accent")}
            >
              Try for free
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
