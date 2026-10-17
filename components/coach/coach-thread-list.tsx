"use client";

import { ChevronDown, MessagesSquare, Plus } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface CoachThreadItem {
  id: string;
  title: string;
  updatedAt: string;
}

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function CoachThreadList({
  threads,
  activeId,
  onSelect,
  onCreate,
}: {
  threads: CoachThreadItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const active = threads.find((thread) => thread.id === activeId);

  return (
    <aside
      aria-label="Coach chats"
      className="flex w-full shrink-0 flex-col gap-3 border-b border-border bg-sidebar p-3 pr-28 md:h-full md:w-64 md:border-r md:border-b-0 md:p-4"
    >
      <p aria-hidden className="hidden px-1 font-label text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase md:block">
        Coach
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCreate}
          className={cn(
            "inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted md:flex-none",
            focusRing,
          )}
        >
          <Plus aria-hidden className="size-4" />
          New chat
        </button>
        {threads.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className={cn(
              "inline-flex h-10 min-w-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:hidden",
              focusRing,
            )}
          >
            <MessagesSquare aria-hidden className="size-4 shrink-0" />
            <span className="max-w-32 truncate">{active?.title ?? `Chats (${threads.length})`}</span>
            <ChevronDown
              aria-hidden
              className={cn("size-4 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")}
            />
          </button>
        ) : null}
      </div>
      {threads.length === 0 ? (
        <p className="hidden px-1 text-xs text-muted-foreground md:block">Your chats will show up here.</p>
      ) : (
        <nav
          id={listId}
          aria-label="Past chats"
          className={cn(
            "max-h-60 flex-col gap-1 overflow-y-auto md:flex md:max-h-none md:flex-1",
            open ? "flex" : "hidden",
          )}
        >
          {threads.map((thread) => {
            const current = activeId === thread.id;
            return (
              <button
                key={thread.id}
                type="button"
                title={thread.title}
                aria-current={current ? "page" : undefined}
                onClick={() => onSelect(thread.id)}
                className={cn(
                  "min-h-10 shrink-0 cursor-pointer truncate border-l-2 border-transparent px-3 py-2 text-left text-sm transition-colors",
                  focusRing,
                  current ? "border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {thread.title}
              </button>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
