import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { VideoMode } from "@/lib/video/modes";

type ToolCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind gradient stops, e.g. "from-sky-300 to-amber-100". */
  tint: string;
  /** Omit for a tool that isn't available yet. */
  href?: string;
};

export function ToolCard({ title, description, icon: Icon, tint, href }: ToolCardProps) {
  const body = (
    <>
      <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br", tint)}>
        <span className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-xl bg-white/90 text-foreground shadow-sm transition-transform group-hover:scale-105">
          <Icon className="size-5" aria-hidden />
        </span>
        {!href && (
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
            Coming soon
          </span>
        )}
      </div>
      <span className="mt-3 block text-sm font-medium">{title}</span>
      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{description}</span>
    </>
  );

  if (!href) {
    return <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-3 opacity-75 shadow-sm">{body}</div>;
  }

  return (
    <Link
      href={href}
      className="group flex h-full cursor-pointer flex-col rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      {body}
    </Link>
  );
}

export function ModeCard({ mode }: { mode: VideoMode }) {
  return (
    <ToolCard
      title={mode.title}
      description={mode.description}
      icon={mode.icon}
      tint={mode.tint}
      href={mode.status === "soon" ? undefined : `/create/${mode.id}`}
    />
  );
}
