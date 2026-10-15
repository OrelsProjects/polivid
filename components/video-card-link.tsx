"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { VideoThumbnail } from "@/components/video/video-player";
import { formatDate } from "@/lib/video/format";
import type { VideoRecord } from "@/lib/video/schema";
import { cn } from "@/lib/utils";

const SEEN_READY_KEY = "polivid:seen-ready";
const EMPTY_SEEN: ReadonlySet<string> = new Set();

let seenIds: ReadonlySet<string> = EMPTY_SEEN;
const listeners = new Set<() => void>();

const readSeenIds = (): ReadonlySet<string> => {
  try {
    const raw = localStorage.getItem(SEEN_READY_KEY);
    if (!raw) return EMPTY_SEEN;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY_SEEN;
    const ids = parsed.filter((id): id is string => typeof id === "string");
    return ids.length > 0 ? new Set(ids) : EMPTY_SEEN;
  } catch {
    return EMPTY_SEEN;
  }
};

const subscribeSeen = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSeenSnapshot = () => seenIds;

const getServerSeenSnapshot = () => EMPTY_SEEN;

const markReadySeen = (id: string) => {
  if (seenIds.has(id)) return;
  const next = new Set(seenIds);
  next.add(id);
  seenIds = next;
  try {
    localStorage.setItem(SEEN_READY_KEY, JSON.stringify([...next].slice(-400)));
  } catch {
    // Private mode or a full quota. The tag still hides for this visit.
  }
  for (const listener of listeners) listener();
};

if (typeof window !== "undefined") seenIds = readSeenIds();

export const VideoCardLink = ({
  video,
  href,
  failed,
  footageUrl,
}: {
  video: VideoRecord;
  href: string;
  failed: boolean;
  footageUrl?: string;
}) => {
  const seen = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getServerSeenSnapshot);
  const showReady = !failed && !seen.has(video.id);

  const handleSeen = () => {
    if (failed) return;
    markReadySeen(video.id);
  };

  return (
    <Link
      href={href}
      onClick={handleSeen}
      onPointerEnter={handleSeen}
      className="group flex cursor-pointer flex-col gap-2.5 rounded-2xl focus-visible:outline-none"
    >
      <div
        className={cn(
          "relative grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl border bg-white shadow-sm transition group-hover:border-primary/30 group-hover:shadow-md group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-focus-visible:ring-offset-2",
          failed ? "border-red-100 bg-red-50" : "border-border",
        )}
      >
        {failed ? (
          <span className="absolute top-3 left-3 z-10 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
            FAILED
          </span>
        ) : null}
        {showReady ? (
          <span
            aria-hidden="true"
            className="absolute top-3 left-3 z-10 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white"
          >
            READY
          </span>
        ) : null}
        {video.plan ? (
          <VideoThumbnail
            plan={video.plan}
            facts={video.facts}
            quotes={video.quotes}
            format={video.format}
            demo={video.demo}
            footageUrl={footageUrl}
            className={video.format === "9:16" ? "h-[92%] w-auto" : "w-[88%]"}
          />
        ) : (
          <div aria-hidden className="flex flex-col items-center gap-2 px-4 text-center">
            <TriangleAlert className="size-5 text-destructive" aria-hidden />
            <span className="text-sm font-medium text-red-900">{video.title}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-2 text-sm font-medium transition-colors group-hover:text-primary group-focus-visible:text-primary">
          {video.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {video.format} · {video.length}s · {formatDate(video.createdAt)}
          {failed ? " · Try again" : ""}
        </span>
      </div>
    </Link>
  );
};
