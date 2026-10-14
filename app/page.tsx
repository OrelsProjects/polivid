import { ArrowRight, BarChart3, FileText, Mic, Sparkles } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { HeroStyles, StylePoster } from "@/components/style-frame";
import { buttonVariants } from "@/components/ui/button";
import { SHOWCASE, showcaseHref, showcaseMeta } from "@/lib/showcase";
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
    tint: "bg-emerald-50 text-emerald-700",
    title: "Article to video",
    body: "Paste a newsletter or post. PoliVid writes a 30, 60, or 90-second script from it.",
    href: "/create?input=article",
    example: null,
  },
  {
    icon: BarChart3,
    tint: "bg-amber-50 text-amber-700",
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
    a: "The app is free while it is in demo. Paid plans will be priced in videos, not credits. Prices are not set yet.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader />

      <main>
        <section className="px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex -space-x-1.5" aria-hidden>
                {["bg-amber-300", "bg-sky-300", "bg-rose-300", "bg-violet-300"].map((color) => (
                  <span key={color} className={cn("size-6 rounded-full ring-2 ring-white", color)} />
                ))}
              </span>
              Built for people who explain things
            </div>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
              Turn any idea into a polished short video.
            </h1>
            <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
              Type a prompt or paste an article. PoliVid writes the script, plans the scenes, and renders a
              captioned preview with crisp motion graphics. Every scene is on screen before you post.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-xl px-5")}>
                Try for free
                <ArrowRight data-icon="inline-end" />
              </Link>
              <a
                href="#showcase"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-xl bg-white px-5")}
              >
                Watch examples
              </a>
            </div>
            <p className="text-xs text-muted-foreground">No credit card required · free while the app is in demo</p>
          </div>
          <HeroStyles />
          <p className="mt-8 text-sm text-muted-foreground">
            Three built-in styles. Bold is what videos look like today. Minimal and Editorial are next.
          </p>
        </section>

        <section id="tools" className="scroll-mt-20 bg-background px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary">START FROM A TOOL</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Pick the input you have.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TOOLS.map(({ icon: Icon, tint, title, body, href, example }) => (
                <Link
                  key={title}
                  href={href}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-primary/30"
                >
                  <span className={cn("grid size-9 place-items-center rounded-xl", tint)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-semibold">{title}</span>
                  {example && <span className="text-sm text-muted-foreground">{example}</span>}
                  <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
                  <span className="mt-auto text-sm font-medium text-primary">Try it →</span>
                </Link>
              ))}
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-white/60 p-5">
                <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Mic className="size-4" aria-hidden />
                </span>
                <span className="flex items-center gap-2 font-semibold">
                  Script to video
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                    SOON
                  </span>
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  Bring your own narration, used word for word. Record it or upload it.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="showcase" className="scroll-mt-20 bg-white px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-primary">SHOWCASE</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">Made with PoliVid.</h2>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">
                Each one opens Create with the prompt and settings prefilled.
              </p>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {SHOWCASE.map((video) => (
                <li key={video.title} className="flex flex-col gap-3">
                  <StylePoster style={video.style} title={video.title} />
                  <p className="text-xs text-muted-foreground">{showcaseMeta(video)}</p>
                  <Link
                    href={showcaseHref(video)}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl bg-white")}
                  >
                    Create similar
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 bg-background px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary">HOW IT WORKS</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Prompt to preview in four steps.</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <li key={step.n} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-primary">{step.n}</span>
                  <p className="mt-3 font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
            <dl className="mt-10 grid gap-6 border-t border-border pt-8 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="border-l-2 border-primary pl-4">
                  <dt className="text-3xl font-semibold tracking-tight">{stat.value}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="faq" className="bg-background px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary">FAQ</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Questions, answered.</h2>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 bg-white px-4 py-20 text-center sm:px-6">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Your next video is one prompt away.
            </h2>
            <p className="text-sm text-muted-foreground">
              Free while PoliVid is in demo. Paid plans will be priced in videos, not credits.
            </p>
            <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-xl px-5")}>
              Try for free
            </Link>
            <p className="text-xs text-muted-foreground">No credit card required</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
