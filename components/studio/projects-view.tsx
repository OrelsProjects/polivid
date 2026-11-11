"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { btn, PageHeader, toggle, TONE, type Tone } from "./studio-ui";

type Kind = "ready" | "failed" | "rendering" | "draft" | "batch";
type FilterId = "all" | "drafts" | "rendering" | "ready" | "failed" | "batches";

const KIND: Record<Kind, { status: string; tone: Tone }> = {
  ready: { status: "Ready", tone: "ready" },
  failed: { status: "Needs attention", tone: "failed" },
  rendering: { status: "Rendering", tone: "rendering" },
  draft: { status: "Draft", tone: "neutral" },
  batch: { status: "Batch · 1 to approve", tone: "attention" },
};

type Thumb = { ratio: string; bg: string; label: string };

export type StudioProjectItem = { title: string; k: Kind; f: FilterId[]; meta: string; href: string; thumbs: Thumb[] };

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "drafts", label: "Drafts" },
  { id: "rendering", label: "Rendering" },
  { id: "ready", label: "Ready" },
  { id: "failed", label: "Needs attention" },
  { id: "batches", label: "Batches" },
];

export function ProjectsView({ items }: { items: StudioProjectItem[] }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const all = items;

  const projects = filter === "all" ? all : all.filter((p) => p.f.includes(filter));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        lede="Drafts, renders and finished outputs. A batch is one project with several videos inside."
        aside={
          <Link href="/studio/create" className={cn(btn.primary, "h-11 px-5")}>
            New video
          </Link>
        }
      />

      <div role="group" aria-label="Filter projects" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const count = f.id === "all" ? all.length : all.filter((p) => p.f.includes(f.id)).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={cn("h-9 cursor-pointer rounded-full border px-3.5 font-medium", toggle(on))}
            >
              {f.label} · {count}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3.5">
        {projects.map((p) => {
          const kind = KIND[p.k];
          return (
            <Link
              key={p.title}
              href={p.href}
              className="flex flex-col gap-2.5 rounded-[16px] border border-[#E4E4EC] bg-white p-3 text-inherit"
            >
              <div className="flex gap-1.5">
                {p.thumbs.map((thumb, i) => (
                  <span
                    key={i}
                    role="img"
                    aria-label="Preview placeholder"
                    className={cn(
                      "flex max-h-[180px] flex-[1_1_0] items-center justify-center rounded-[10px] text-[12px] text-[#6B6A7B]",
                      thumb.ratio,
                      thumb.bg,
                    )}
                  >
                    {thumb.label}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 px-1 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[14px] leading-[1.3] font-semibold">{p.title}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                      TONE[kind.tone],
                    )}
                  >
                    {kind.status}
                  </span>
                </div>
                <span className="text-[12px] text-[#6B6A7B]">{p.meta}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-[#C9C8D6] bg-[#FAFAFC] p-8 text-center text-[#3F3D4F]">
          Nothing here with this filter.
        </div>
      )}

      <p className="mt-2 mb-0 text-[12px] text-[#6B6A7B]">
        Advanced: the planned-and-approved production workflow stays reachable from a project, not as a separate tool
        to choose up front.
      </p>
    </div>
  );
}
