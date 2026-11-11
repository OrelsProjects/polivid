"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { carryPromptToNextTool } from "@/components/create/use-create-form";
import { cn } from "@/lib/utils";
import { toolBySlug } from "@/lib/video/tool-catalog";

/** The ways to begin. Each one opens a catalog tool, so the list stays in step with the gallery. */
const STARTING_POINTS: readonly { slug: string; label: string }[] = [
  { slug: "prompt", label: "From an idea" },
  { slug: "voiceover", label: "From a script" },
  { slug: "shorts", label: "With a presenter" },
  { slug: "image", label: "From a picture" },
  { slug: "music", label: "From a song" },
  { slug: "motion-graphics", label: "Motion graphics" },
];

const chip =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Sits above the create form. Picking another starting point opens that tool and
 * carries over whatever was typed, so changing your mind does not cost the text.
 */
export function StartingPointBar({ current }: { current: string | null }) {
  const active = toolBySlug(current);
  const listed = STARTING_POINTS.some((point) => point.slug === current);
  return (
    <nav aria-label="Starting point" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Pick a starting point. What you have typed comes with you.</p>
      <div className="flex flex-wrap gap-2">
        {STARTING_POINTS.map(({ slug, label }) => {
          const tool = toolBySlug(slug);
          if (!tool) return null;
          const Icon = tool.icon;
          const selected = current === slug;
          return (
            <Link
              key={slug}
              href={`/create/${slug}`}
              aria-current={selected ? "page" : undefined}
              onClick={carryPromptToNextTool}
              className={cn(
                chip,
                selected
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
        {active && !listed ? (
          <span aria-current="page" className={cn(chip, "border-primary bg-primary/5 text-foreground")}>
            <active.icon className="size-4" aria-hidden />
            {active.title}
          </span>
        ) : null}
        <Link
          href="/tools"
          className={cn(chip, "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")}
        >
          <LayoutGrid className="size-4" aria-hidden />
          All tools
        </Link>
      </div>
    </nav>
  );
}

/** Reads the open tool from the address. Kept apart so the bar itself can render without a request. */
export function CurrentStartingPointBar() {
  const pathname = usePathname();
  const slug = pathname?.startsWith("/create/") ? (pathname.split("/")[2] ?? null) : null;
  return <StartingPointBar current={slug} />;
}
