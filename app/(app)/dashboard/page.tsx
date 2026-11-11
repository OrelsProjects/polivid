import {
  ArrowUpRight,
  BarChart3,
  Box,
  ChevronDown,
  Clock,
  Coins,
  FileText,
  LayoutGrid,
  MessageSquare,
  Play,
  Sparkles,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FeatureCarousel } from "@/components/home/feature-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video-card";
import { getBalance } from "@/lib/billing/credits";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { availableGenerationModelIds } from "@/lib/video/available-models";
import { liveTools, toolBySlug } from "@/lib/video/tool-catalog";
import { listMyVideos } from "@/lib/videos";

export const metadata: Metadata = { title: "Dashboard" };

const picture = (name: string) => `/presets/${name}.png`;

/** The wide cards at the top. Each opens a tool. */
const FEATURES = [
  {
    href: "/create/direct",
    image: picture("movie"),
    title: "Direct Prompt",
    body: "Your words go to the video model exactly as typed. No planning step, one clip.",
  },
  {
    href: "/create/script-to-video",
    image: picture("painterly-storybook"),
    title: "Script to Video - One Picture Per Line",
    body: "Read word for word. Add [notes] for the pictures and pauses between lines.",
  },
  {
    href: "/create/shorts",
    image: picture("photography"),
    title: "Shorts - Your Character, Any Script",
    body: "A saved character says your script to camera, in the look you pick.",
  },
  {
    href: "/create/avatar",
    image: picture("realist"),
    title: "Talking Avatar",
    body: "One picture and a script become a presenter who speaks your lines.",
  },
  {
    href: "/create/lyrics",
    image: picture("retro-cartoon"),
    title: "Lyrics to Music Video",
    body: "Write the lyrics. We make the song and the video that goes with it.",
  },
] as const;

const NOW_SHOWING = {
  href: "/create/direct",
  image: picture("movie"),
  title: "How Direct Prompt Sends Your Words Straight to the Model",
  body: "Type the clip you want. Nothing is planned, split or rewritten, and one clip comes back in about five minutes.",
  action: "Try Direct Prompt",
  short: "Direct Prompt, straight to the model",
};

const ALSO_FEATURED = [
  { href: "/create/script-to-video", image: picture("painterly-storybook"), title: "Script notes and pauses, line by line" },
  { href: "/create/direct?model=kling-4", image: picture("sci-fi"), title: "Kling 4.0 is in the model picker" },
  { href: "/tools", image: picture("papercraft-diorama"), title: "Every tool in one gallery" },
] as const;

/** The tile wall. `wide` tiles take three shares of the row, the rest one. */
const WALL: readonly (readonly { slug: string; image: string; wide?: boolean }[])[] = [
  [
    { slug: "prompt", image: picture("movie"), wide: true },
    { slug: "shorts", image: picture("photography") },
    { slug: "avatar", image: picture("realist") },
    { slug: "product-ad", image: picture("3d-render") },
    { slug: "explainer", image: picture("educational") },
    { slug: "voiceover", image: picture("editorial"), wide: true },
  ],
  [
    { slug: "story", image: picture("fantasy") },
    { slug: "captions", image: picture("bold") },
    { slug: "script-to-video", image: picture("painterly-storybook"), wide: true },
    { slug: "image", image: picture("environment") },
    { slug: "edit", image: picture("minimal") },
    { slug: "lyrics", image: picture("retro-cartoon") },
    { slug: "article-to-video", image: picture("paper-collage"), wide: true },
  ],
];

const SHORTCUTS: readonly { href: string; title: string; body: string; icon: LucideIcon }[] = [
  { href: "/create", title: "Create Video", body: "Describe a clip and film it", icon: Sparkles },
  { href: "/coach", title: "PoliVid Coach", body: "Plan a video in a chat, then approve the brief", icon: MessageSquare },
  { href: "/tools", title: "PoliVid Tools", body: "Tools for ads, shorts, stories and edits", icon: LayoutGrid },
  { href: "/create/script-to-video", title: "Script to Video", body: "One script, a picture for every line", icon: FileText },
];

const PANEL = "rounded-[20px] border border-border bg-surface";
const WHITE_PILL =
  "inline-flex h-[46px] items-center gap-2.5 rounded-full bg-white px-[22px] text-[15px] font-semibold text-neutral-950 hover:bg-neutral-200";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-14 pt-8 pb-20 sm:pt-12">
      <FeatureCarousel label="New in PoliVid">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group flex w-[min(470px,82vw)] shrink-0 snap-start flex-col gap-3"
          >
            <span className="relative block h-[264px] overflow-hidden rounded-[18px] bg-muted">
              <Image
                src={feature.image}
                alt=""
                fill
                sizes="470px"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </span>
            <span className="flex flex-col gap-0.5 px-1">
              <span className="text-[15px] font-semibold">{feature.title}</span>
              <span className="truncate text-[13px] text-muted-foreground">{feature.body}</span>
            </span>
          </Link>
        ))}
      </FeatureCarousel>

      <div className="mx-auto flex w-full max-w-[1344px] flex-col gap-14 px-5">
        <section className="mx-auto flex w-full max-w-[1178px] flex-col gap-4">
          <h2 className="text-2xl font-semibold tracking-normal">Featured</h2>
          <div className="flex flex-wrap gap-3.5">
            <div className="flex min-w-0 flex-[999_1_560px] flex-wrap items-center gap-6 rounded-[20px] border border-border bg-[#17130f] p-[22px]">
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3.5">
                <h3 className="text-2xl leading-[1.3] font-semibold">{NOW_SHOWING.title}</h3>
                <p className="text-[15px] text-neutral-300">{NOW_SHOWING.body}</p>
                <Link href={NOW_SHOWING.href} className={cn(WHITE_PILL, "self-start")}>
                  <Play className="size-3.5 fill-current" aria-hidden />
                  {NOW_SHOWING.action}
                </Link>
              </div>
              <span className="relative block h-[280px] min-w-0 flex-[1.6_1_320px] overflow-hidden rounded-[14px] bg-muted">
                <Image src={NOW_SHOWING.image} alt="" fill sizes="(min-width: 1024px) 520px, 90vw" className="object-cover" />
              </span>
            </div>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1 rounded-[20px] border border-border bg-card p-2">
              <Link href={NOW_SHOWING.href} className="flex items-center gap-3 rounded-xl bg-accent p-1.5">
                <FeaturedThumb src={NOW_SHOWING.image} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    Now showing
                  </span>
                  <span className="text-sm font-semibold">{NOW_SHOWING.short}</span>
                </span>
              </Link>
              {ALSO_FEATURED.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl p-1.5 text-neutral-300 hover:bg-accent/60 hover:text-foreground"
                >
                  <FeaturedThumb src={item.image} />
                  <span className="min-w-0 text-sm">{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(PANEL, "mx-auto flex w-full max-w-[1216px] flex-col gap-5 p-5")}>
          <Suspense fallback={<Skeleton className="h-[92px] rounded-[14px]" />}>
            <WorkspaceStats />
          </Suspense>
          <Link
            href="/billing"
            className="inline-flex h-11 items-center gap-2.5 self-start rounded-full border border-input bg-muted px-4 text-[13px] text-neutral-300 hover:text-foreground"
          >
            <BarChart3 className="size-3.5" aria-hidden />
            Show usage &amp; credits
            <ChevronDown className="size-3.5" aria-hidden />
          </Link>
        </section>

        <section id="tools" className="flex flex-col items-center">
          <div className="grid h-[84px] w-[284px] max-w-full place-items-center rounded-t-[28px] border border-b-0 border-border bg-[#171717]">
            <h2 className="text-[40px] leading-none font-bold tracking-[0.02em] text-violet-200 italic">TOOLS</h2>
          </div>
          <div className="relative flex w-full flex-col gap-2 rounded-[28px] border border-border bg-[#171717] p-4">
            {WALL.map((row, index) => (
              <div key={index} className="flex flex-wrap gap-2">
                {row.map((tile) => {
                  const tool = toolBySlug(tile.slug);
                  if (!tool) return null;
                  return (
                    <Link
                      key={tile.slug}
                      href={`/create/${tool.slug}`}
                      className={cn(
                        "group relative flex items-end overflow-hidden rounded-xl bg-muted p-3 font-medium text-white",
                        index === 0 ? "h-[200px]" : "h-[170px]",
                        tile.wide ? "flex-[3_1_240px]" : "flex-[1_1_110px]",
                      )}
                    >
                      <Image
                        src={tile.image}
                        alt=""
                        fill
                        sizes={tile.wide ? "420px" : "200px"}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/75 to-transparent" />
                      <span className="relative">{tool.title}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 rounded-b-[28px] bg-linear-to-t from-[#171717] to-transparent" />
            <Link
              href="/tools"
              className={cn(WHITE_PILL, "absolute bottom-[34px] left-1/2 h-[46px] -translate-x-1/2 gap-2 px-5 text-sm whitespace-nowrap")}
            >
              View all tools
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>

        <section className="flex flex-wrap gap-4">
          <div className="relative flex min-h-[256px] min-w-0 flex-[1_1_520px] flex-col justify-center gap-3 overflow-hidden rounded-[20px] bg-[#14225a] p-7">
            <Image src={picture("sci-fi")} alt="" fill sizes="(min-width: 1024px) 660px, 100vw" className="object-cover opacity-55" />
            <h3 className="relative max-w-[300px] text-[22px] leading-[1.3] font-semibold">
              Kling 4.0 is here: clips up to 30 seconds
            </h3>
            <p className="relative max-w-[280px] text-[15px] text-blue-100">
              Stereo sound and its own shot planning, at 720p or 1080p.
            </p>
            <Link
              href="/create/direct?model=kling-4"
              className="relative inline-flex h-11 items-center gap-2 self-start rounded-[10px] bg-white px-[18px] text-[15px] font-semibold text-neutral-950 hover:bg-neutral-200"
            >
              <Sparkles className="size-4" aria-hidden />
              Try Kling 4.0
            </Link>
          </div>
          <div className="flex min-w-0 flex-[1_1_520px] flex-wrap gap-3">
            {SHORTCUTS.map(({ href, title, body, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-[1_1_220px] flex-col gap-2.5 rounded-2xl border border-border bg-card px-[18px] py-[22px] hover:border-input hover:bg-muted"
              >
                <Icon className="size-6" strokeWidth={1.6} aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold">{title}</span>
                  <span className="text-[13px] text-muted-foreground">{body}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={cn(PANEL, "mx-auto flex w-full max-w-[1216px] flex-col gap-3.5 px-4 pt-[18px] pb-6")}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-normal">Continue where you left off</h2>
            <Link href="/videos" className="text-[13px] text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <Suspense fallback={<RecentSkeleton />}>
            <RecentVideos />
          </Suspense>
        </section>

        <Link
          href="/characters"
          className={cn(PANEL, "mx-auto -mt-7 flex w-full max-w-[1216px] items-center gap-3.5 rounded-2xl p-5 hover:border-input")}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
            <UserRound className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">Characters &amp; voices</span>
            <span className="text-muted-foreground">Save a character once and use it in every video</span>
          </span>
        </Link>

        <section className="flex flex-wrap items-center overflow-hidden rounded-[20px] bg-[#0c0c0c]">
          <span className="relative block h-[214px] flex-[1_1_300px] bg-muted">
            <Image src={picture("modern-noir")} alt="" fill sizes="(min-width: 1024px) 340px, 100vw" className="object-cover grayscale" />
          </span>
          <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-2.5 px-6 py-6 sm:px-10">
            <span className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">PoliVid Coach</span>
            <h3 className="text-[32px] leading-[1.2] font-semibold">
              Plan with the Coach. <span className="font-normal text-blue-400 italic">Film it in one approval.</span>
            </h3>
            <p className="text-neutral-400">
              Tell it what you want. It writes the brief, and nothing is filmed until you say yes.
            </p>
            <Link
              href="/coach"
              className="inline-flex h-11 items-center self-start rounded-lg bg-white px-[18px] text-[15px] font-medium text-neutral-950 hover:bg-neutral-200"
            >
              Open the Coach
            </Link>
          </div>
        </section>

        <Link
          href="/tools"
          className="inline-flex h-12 items-center gap-3 self-center rounded-full border border-border bg-surface py-0 pr-[22px] pl-4 text-[15px] text-neutral-300 hover:text-foreground"
        >
          <span className="flex" aria-hidden>
            {[picture("movie"), picture("photography"), picture("sci-fi"), picture("fantasy")].map((src, index) => (
              <span
                key={src}
                className={cn("relative size-[22px] overflow-hidden rounded-md border-2 border-surface", index > 0 && "-ml-2")}
              >
                <Image src={src} alt="" fill sizes="22px" className="object-cover" />
              </span>
            ))}
          </span>
          Explore tools &amp; models
          <ChevronDown className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function FeaturedThumb({ src }: { src: string }) {
  return (
    <span className="relative block h-[66px] w-[118px] shrink-0 overflow-hidden rounded-lg bg-muted">
      <Image src={src} alt="" fill sizes="118px" className="object-cover" />
    </span>
  );
}

async function WorkspaceStats() {
  const user = await getCurrentUser();
  const [videos, balance] = await Promise.all([listMyVideos(), getBalance(user.id)]);
  const ready = videos.filter((video) => video.status === "ready");
  const minutes = ready.reduce((sum, video) => sum + video.length, 0) / 60;
  const stats: readonly { label: string; value: string; icon: LucideIcon; chip: string }[] = [
    { label: "Videos", value: String(ready.length), icon: Video, chip: "bg-violet-400/15 text-violet-300" },
    {
      label: "Minutes",
      value: Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1),
      icon: Clock,
      chip: "bg-sky-400/15 text-sky-300",
    },
    { label: "Tools", value: String(liveTools().length), icon: LayoutGrid, chip: "bg-amber-400/15 text-amber-300" },
    {
      label: "Models",
      value: String(availableGenerationModelIds().length),
      icon: Box,
      chip: "bg-emerald-400/15 text-emerald-300",
    },
    {
      label: "Credits left",
      value: balance.total.toLocaleString("en-US"),
      icon: Coins,
      chip: "bg-indigo-400/15 text-indigo-300",
    },
  ];
  const name = user.name ?? user.email ?? "My workspace";

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-[54px] items-center gap-2.5 rounded-xl border border-input bg-muted px-3">
        <span aria-hidden className="grid size-[34px] place-items-center rounded-[9px] bg-primary text-sm font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[9px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Workspace</span>
          <span className="max-w-40 truncate text-sm font-semibold">{name}</span>
        </span>
      </div>
      <dl className="flex min-w-0 flex-[999_1_520px] flex-wrap overflow-hidden rounded-[14px] border border-border bg-muted">
        {stats.map(({ label, value, icon: Icon, chip }) => (
          <div key={label} className="flex flex-[1_1_150px] flex-col gap-3 border-r border-border p-4 last:border-r-0">
            <dt className="flex items-center justify-between text-[11px] font-medium tracking-[0.06em] text-neutral-400 uppercase">
              {label}
              <span aria-hidden className={cn("grid size-7 place-items-center rounded-lg", chip)}>
                <Icon className="size-3.5" />
              </span>
            </dt>
            <dd className="text-2xl leading-none font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function RecentVideos() {
  const videos = await listMyVideos();
  if (videos.length === 0) return <EmptyState />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {videos.slice(0, 5).map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {[0, 1, 2, 3, 4].map((index) => (
        <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
      ))}
    </div>
  );
}
