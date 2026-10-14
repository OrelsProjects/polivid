import { BarChart3, FileText, Mic, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { Greeting } from "@/components/greeting";
import { PromptBox } from "@/components/prompt-box";
import { StylePoster } from "@/components/style-frame";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video-card";
import { SHOWCASE, showcaseHref, showcaseMeta } from "@/lib/showcase";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listMyVideos } from "@/lib/videos";

export const metadata: Metadata = { title: "Dashboard" };

const TOOLS = [
  {
    href: "/create?input=topic",
    title: "Topic to video",
    body: "Explain an idea",
    icon: Sparkles,
    tint: "bg-primary/10 text-primary",
  },
  {
    href: "/create?input=article",
    title: "Article to video",
    body: "Paste a post",
    icon: FileText,
    tint: "bg-emerald-50 text-emerald-700",
  },
  {
    href: "/create?input=data",
    title: "Data story",
    body: "Sourced charts",
    icon: BarChart3,
    tint: "bg-amber-50 text-amber-700",
  },
] as const;

const STARTERS = [SHOWCASE[3], SHOWCASE[5], SHOWCASE[4]];

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <Suspense fallback={<Skeleton className="h-10 w-72" />}>
        <DashboardHello />
      </Suspense>
      <PromptBox />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map(({ href, title, body, icon: Icon, tint }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm transition hover:border-primary/30"
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tint)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{body}</span>
            </span>
          </Link>
        ))}
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-white/70 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Mic className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium">
              Script to video
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                SOON
              </span>
            </span>
            <span className="block text-xs text-muted-foreground">Coming soon</span>
          </span>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>

      <section id="showcase" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-semibold">Start from a showcase video</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Opens Create with the prompt and settings prefilled
          </p>
        </div>
        <ul className="grid gap-3 lg:grid-cols-3">
          {STARTERS.map((video) => (
            <li key={video.title}>
              <Link
                href={showcaseHref(video)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:border-primary/30"
              >
                <StylePoster style={video.style} title={video.title} size="sm" className="w-16 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{video.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {showcaseMeta(video)} · {video.style[0].toUpperCase()}
                    {video.style.slice(1)}
                  </span>
                </span>
                <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 rounded-xl bg-white")}>
                  Create similar
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function DashboardHello() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-1">
      <Greeting name={user.name ?? user.email ?? "there"} />
      <p className="text-muted-foreground">What&apos;s your video about today?</p>
    </div>
  );
}

async function DashboardContent() {
  const videos = await listMyVideos();
  const ready = videos.filter((video) => video.status === "ready");
  const minutes = ready.reduce((sum, video) => sum + video.length, 0) / 60;
  const stats = [
    { label: "Videos made", hint: "Since you joined", value: String(ready.length) },
    {
      label: "Minutes rendered",
      hint: "Across all previews",
      value: Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1),
    },
    { label: "Exports", hint: "MP4 downloads", value: "0" },
  ];

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{stat.hint}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent videos</h2>
          {videos.length > 0 && (
            <Link href="/videos" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          )}
        </div>
        {videos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {videos.slice(0, 4).map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
