import Link from "next/link";
import { cn } from "@/lib/utils";
import type { VideoMode } from "@/lib/video/modes";

export function ModeCard({ mode }: { mode: VideoMode }) {
  const Icon = mode.icon;
  const soon = mode.status === "soon";
  const body = (
    <>
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br",
          mode.tint,
        )}
      >
        <Icon
          className="absolute right-4 bottom-4 size-10 text-white/85 drop-shadow-sm"
          aria-hidden
        />
        {soon && (
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
            Coming soon
          </span>
        )}
      </div>
      <span className="mt-3 block text-sm font-medium">{mode.title}</span>
      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
        {mode.description}
      </span>
    </>
  );

  if (soon) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-col rounded-2xl border border-border bg-white p-3 opacity-80 shadow-sm"
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/create/${mode.id}`}
      aria-label={mode.title}
      className="flex cursor-pointer flex-col rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {body}
    </Link>
  );
}
