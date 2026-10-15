import Link from "next/link";
import { cn } from "@/lib/utils";

export const VIDEO_FILTERS = [
  { id: "all", label: "All" },
  { id: "done", label: "Done" },
  { id: "progress", label: "In progress" },
  { id: "failed", label: "Failed" },
] as const;

export type VideoFilter = (typeof VIDEO_FILTERS)[number]["id"];

export const parseVideoFilter = (value: string | string[] | undefined): VideoFilter => {
  const raw = Array.isArray(value) ? value[0] : value;
  return VIDEO_FILTERS.some((filter) => filter.id === raw) ? (raw as VideoFilter) : "all";
};

export const videoFilterHref = (filter: VideoFilter) => (filter === "all" ? "/videos" : `/videos?filter=${filter}`);

export const VideoFilters = ({ current }: { current: VideoFilter }) => {
  return (
    <nav aria-label="Filter videos" className="flex flex-wrap gap-2">
      {VIDEO_FILTERS.map((filter) => {
        const selected = current === filter.id;
        return (
          <Link
            key={filter.id}
            href={videoFilterHref(filter.id)}
            aria-current={selected ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center rounded-xl px-3 text-sm font-medium transition-colors",
              selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </nav>
  );
};
