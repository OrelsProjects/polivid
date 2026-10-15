import { Download, ExternalLink, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { CopyButton } from "@/components/copy-button";
import { NewProjectButton } from "@/components/editor/new-project-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayer } from "@/components/video/video-player";
import { hasFootage } from "@/lib/video/footage";
import { getMyVideo } from "@/lib/videos";
import { domainOf, fillPlaceholders, formatDate, formatFact, formatValue } from "@/lib/video/format";
import { generationModelBySlug, generationModelLabel } from "@/lib/video/models";
import type { SceneType, VideoRecord } from "@/lib/video/schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Video" };

const SCENE_LABEL: Record<SceneType, string> = {
  hook: "Hook",
  text: "Title",
  footage: "Footage",
  big_number: "Big number",
  bars: "Chart",
  line: "Chart",
  quote: "Quote",
  sources: "Sources",
};

export default function VideoPage({ params }: PageProps<"/videos/[id]">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <VideoDetail id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function VideoDetail({ id }: { id: string }) {
  const video = await getMyVideo(id);
  if (!video) notFound();
  const footageUrl = (await hasFootage(video.id)) ? `/api/videos/${video.id}/file` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/videos">My videos</BackLink>
        <h1 className="text-3xl font-semibold tracking-tight text-balance [overflow-wrap:anywhere]">{video.title}</h1>
        {video.parentVideoId && (
          <p className="text-sm text-muted-foreground">
            Edited from{" "}
            <Link href={`/videos/${video.parentVideoId}`} className="text-primary underline-offset-4 hover:underline">
              the original video
            </Link>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{video.format}</span>
          <span aria-hidden>·</span>
          <span>{video.length}s</span>
          <span aria-hidden>·</span>
          <span>Bold</span>
          {video.model !== "demo" && (
            <>
              <span aria-hidden>·</span>
              <span>{generationModelLabel(video.model)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{formatDate(video.createdAt)}</span>
          <span aria-hidden>·</span>
          <span className="block max-w-full min-w-0 truncate sm:max-w-md" title={video.prompt}>
            “{video.prompt}”
          </span>
          {video.demo && <Badge variant="outline">Sample data</Badge>}
        </div>
      </div>

      {video.status === "failed" || !video.plan ? (
        <FailedVideo video={video} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <VideoPlayer
              plan={video.plan}
              facts={video.facts}
              quotes={video.quotes}
              format={video.format}
              demo={video.demo}
              footageUrl={footageUrl}
              className={video.format === "9:16" ? "mx-auto w-full max-w-[380px]" : "w-full"}
            />
            <NewProjectButton videoId={video.id} label="Edit in editor" />
            {footageUrl ? (
              <a href={footageUrl} download className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 rounded-xl")}>
                <Download data-icon="inline-start" />
                Download MP4
              </a>
            ) : (
              <Button variant="outline" size="lg" disabled className="h-12 rounded-xl" title="This video has no filmed clip">
                <Download data-icon="inline-start" />
                Export MP4
              </Button>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {footageUrl
                ? "This file is the clip the model filmed. Nothing is posted anywhere until you share it yourself."
                : "This one is a drawn preview. Generate again to film it with a video model."}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Script video={video} />
            <Sources video={video} />
          </div>
        </div>
      )}
    </div>
  );
}

function Script({ video }: { video: VideoRecord }) {
  const scenes = video.plan?.scenes ?? [];
  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Scenes · {scenes.length}</h2>
        <p className="text-xs text-muted-foreground">In order. Open the editor to change clips, text, and audio.</p>
      </div>
      <ol className="mt-3 flex flex-col">
        {scenes.map((scene, index) => (
          <li key={`${scene.type}-${index}`} className="flex gap-3 border-t border-border py-3 first:border-t-0">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#0C1222] text-[10px] font-semibold text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">
                {SCENE_LABEL[scene.type]} · {scene.durationSec}s
              </div>
              <p className="text-sm">
                {scene.quote
                  ? `“${scene.quote.text}” — ${scene.quote.speaker}`
                  : fillPlaceholders(scene.narration, video.facts)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Sources({ video }: { video: VideoRecord }) {
  if (video.facts.length === 0) return null;
  const unverified = new Set(video.unverifiedFactIds);
  const copyText = video.facts
    .map((fact) => {
      const value = fact.kind === "number" ? formatFact(fact) : "";
      return [
        `${fact.label}${value ? ` ${value}` : ""}`,
        `“${fact.sourceQuote}”`,
        `${fact.sourceTitle} · ${domainOf(fact.sourceUrl)} · ${fact.asOf}`,
      ].join("\n");
    })
    .join("\n\n");

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          Sources · {video.facts.length} {video.facts.length === 1 ? "fact" : "facts"}
        </h2>
        <CopyButton text={copyText} />
      </div>
      <ul className="mt-2 flex flex-col">
        {video.facts.map((fact) => (
          <li key={fact.id} className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">{fact.label}</span>
              {fact.kind === "number" && (
                <span className="shrink-0 font-semibold tabular-nums">{formatFact(fact)}</span>
              )}
            </div>
            {fact.kind === "series" && fact.points && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
                {fact.points.map((point) => (
                  <span key={point.label}>
                    <span className="text-muted-foreground">{point.label}</span>{" "}
                    <span className="font-semibold">{formatValue(point.value, fact)}</span>
                  </span>
                ))}
              </div>
            )}
            <blockquote className="text-sm text-muted-foreground">“{fact.sourceQuote}”</blockquote>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {fact.sourceTitle} · {domainOf(fact.sourceUrl)}
                <ExternalLink className="size-3" aria-hidden />
              </a>
              <span className="text-muted-foreground">{fact.asOf}</span>
              {unverified.has(fact.id) && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900">
                  Check it · source not in search results
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function retryHref(video: VideoRecord) {
  const params = new URLSearchParams({
    prompt: video.prompt,
    format: video.format,
    length: String(video.length),
  });
  const model = generationModelBySlug(video.model);
  if (model) params.set("model", model.id);
  return `/create?${params.toString()}`;
}

function FailedVideo({ video }: { video: VideoRecord }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm" role="alert">
        <span className="flex items-center gap-2 font-medium text-destructive">
          <TriangleAlert className="size-4" aria-hidden />
          Couldn&apos;t make this video
        </span>
        <span className="text-muted-foreground">{video.error}</span>
        <Link
          href={retryHref(video)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-fit rounded-xl bg-white")}
        >
          Try again
        </Link>
      </div>
      {video.facts.length > 0 && <Sources video={video} />}
    </div>
  );
}
