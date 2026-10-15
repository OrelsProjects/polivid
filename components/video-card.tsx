import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { VideoThumbnail } from "@/components/video/video-player";
import { hasFootage } from "@/lib/video/footage";
import type { VideoRecord } from "@/lib/video/schema";
import { cn } from "@/lib/utils";

export function VideoCard({ video }: { video: VideoRecord }) {
  const failed = video.status === "failed" || !video.plan;
  const href = failed ? `/videos/${video.id}` : `/editor/open/${video.id}`;

  return (
    <Link href={href} className="group flex cursor-pointer flex-col gap-2.5 focus-visible:outline-none">
      <div
        className={cn(
          "relative grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl border bg-white shadow-sm transition group-hover:border-primary/30",
          failed ? "border-red-100 bg-red-50" : "border-border",
        )}
      >
        <span
          className={cn(
            "absolute top-3 left-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
            failed ? "bg-red-600 text-white" : "bg-emerald-600 text-white",
          )}
        >
          {failed ? "FAILED" : "READY"}
        </span>
        {video.plan ? (
          <VideoThumbnail
            plan={video.plan}
            facts={video.facts}
            quotes={video.quotes}
            format={video.format}
            demo={video.demo}
            footageUrl={hasFootage(video.id) ? `/api/videos/${video.id}/file` : undefined}
            className={video.format === "9:16" ? "h-[92%] w-auto" : "w-[88%]"}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <TriangleAlert className="size-5 text-destructive" aria-hidden />
            <span className="text-sm font-medium text-red-900">{video.title}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-2 text-sm font-medium group-hover:text-primary">{video.title}</span>
        <span className="text-xs text-muted-foreground">
          {video.format} · {video.length}s · {formatDate(video.createdAt)}
          {failed ? " · Try again" : ""}
        </span>
      </div>
    </Link>
  );
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
