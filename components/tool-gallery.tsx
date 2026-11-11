"use client";

import { Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { ToolCard, ToolTile } from "@/components/mode-card";
import { cn } from "@/lib/utils";
import {
  CREATE_TOOLS,
  TOOL_CATEGORIES,
  featuredTools,
  toolMatches,
  type CreateTool,
  type ToolCategoryId,
} from "@/lib/video/tool-catalog";

type Filter = "all" | "featured" | ToolCategoryId;

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

const ProductionsCard = () => (
  <ToolCard
    title="Productions"
    description="Develop a script, plan shots, generate, and assemble a finished cut."
    icon={Sparkles}
    tint="from-violet-500 to-indigo-700"
    href="/productions"
  />
);

const Tiles = ({ tools, lead }: { tools: readonly CreateTool[]; lead?: boolean }) => (
  <ul className={GRID}>
    {lead ? (
      <li>
        <ProductionsCard />
      </li>
    ) : null}
    {tools.map((tool) => (
      <li key={tool.slug}>
        <ToolTile tool={tool} />
      </li>
    ))}
  </ul>
);

/** Every Create tool, grouped by what it is for, with a search box and category filters. */
export function ToolGallery() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const featured = useMemo(() => featuredTools(), []);
  const filters = useMemo(
    () => [
      { id: "all" as const, label: "All", count: CREATE_TOOLS.length },
      { id: "featured" as const, label: "Featured", count: featured.length },
      ...TOOL_CATEGORIES.map((category) => ({
        id: category.id,
        label: category.label,
        count: CREATE_TOOLS.filter((tool) => tool.category === category.id).length,
      })),
    ],
    [featured],
  );

  const searching = query.trim().length > 0;
  const matches = useMemo(() => {
    const pool =
      filter === "all"
        ? CREATE_TOOLS
        : filter === "featured"
          ? featured
          : CREATE_TOOLS.filter((tool) => tool.category === filter);
    return pool.filter((tool) => toolMatches(tool, query));
  }, [filter, featured, query]);
  const grouped = filter === "all" && !searching;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search tools</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by goal, input, or format"
            className="h-10 w-full rounded-xl border border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <div role="group" aria-label="Tool categories" className="flex flex-wrap gap-2">
          {filters.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium transition",
                filter === id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="text-xs tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {grouped ? (
        <>
          <section aria-labelledby="tools-featured" className="flex flex-col gap-3">
            <h2 id="tools-featured" className="text-lg font-semibold tracking-tight">
              Featured
            </h2>
            <Tiles tools={featured} lead />
          </section>
          {TOOL_CATEGORIES.map((category) => (
            <section key={category.id} aria-labelledby={`tools-${category.id}`} className="flex flex-col gap-3">
              <h2 id={`tools-${category.id}`} className="text-lg font-semibold tracking-tight">
                {category.label}
              </h2>
              <Tiles tools={CREATE_TOOLS.filter((tool) => tool.category === category.id)} />
            </section>
          ))}
        </>
      ) : matches.length > 0 ? (
        <Tiles tools={matches} />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm">
          <p className="font-medium">No tools match that search.</p>
          <p className="mt-1 text-muted-foreground">Try a broader word, or look through every tool.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="mt-3 cursor-pointer text-primary underline-offset-4 hover:underline"
          >
            Show all tools
          </button>
        </div>
      )}
    </div>
  );
}
