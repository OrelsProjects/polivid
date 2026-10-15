import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActiveJobCards } from "@/components/active-job-cards";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video-card";
import { parseVideoFilter, VideoFilters, videoFilterHref, type VideoFilter } from "@/components/video-filters";
import type { VideoRecord } from "@/lib/video/schema";
import { listMyActiveJobs, listMyVideos } from "@/lib/videos";

export const metadata: Metadata = { title: "My videos" };

const EMPTY_FILTER: Record<Exclude<VideoFilter, "all">, string> = {
  done: "No finished videos yet.",
  progress: "Nothing is in progress.",
  failed: "No failed videos.",
};

export default function VideosPage({ searchParams }: PageProps<"/videos">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My videos</h1>
        <p className="mt-1 text-sm text-muted-foreground">In progress and finished. Export is next.</p>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
            ))}
          </div>
        }
      >
        <FilteredLibrary searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FilteredLibrary({ searchParams }: { searchParams: PageProps<"/videos">["searchParams"] }) {
  const params = await searchParams;
  const filter = parseVideoFilter(params.filter);
  return (
    <>
      <VideoFilters current={filter} />
      <VideoGrid filter={filter} />
    </>
  );
}

const isFailedVideo = (video: VideoRecord) => video.status === "failed" || !video.plan;

async function VideoGrid({ filter }: { filter: VideoFilter }) {
  const [videos, jobs] = await Promise.all([listMyVideos(), listMyActiveJobs()]);
  const showJobs = filter === "all" || filter === "progress";
  const visibleVideos = videos.filter((video) => {
    if (filter === "progress") return false;
    if (filter === "done") return !isFailedVideo(video);
    if (filter === "failed") return isFailedVideo(video);
    return true;
  });
  const visibleJobs = showJobs ? jobs : [];

  if (visibleVideos.length === 0 && visibleJobs.length === 0) {
    if (filter === "all") return <EmptyState />;
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm">
        <p className="text-muted-foreground">{EMPTY_FILTER[filter]}</p>
        <Link href={videoFilterHref("all")} className="rounded-md font-medium text-primary underline-offset-4 hover:underline">
          Show all videos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {showJobs ? <ActiveJobCards initialJobs={visibleJobs} /> : null}
      {visibleVideos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
