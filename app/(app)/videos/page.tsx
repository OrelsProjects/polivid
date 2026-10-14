import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video-card";
import { listMyVideos } from "@/lib/videos";

export const metadata: Metadata = { title: "My videos" };

export default function VideosPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My videos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Previews you&apos;ve made. Export is next.</p>
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
        <VideoGrid />
      </Suspense>
    </div>
  );
}

async function VideoGrid() {
  const videos = await listMyVideos();
  if (videos.length === 0) return <EmptyState />;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
