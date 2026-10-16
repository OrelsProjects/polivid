import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CoachThreadItem {
  id: string;
  title: string;
  updatedAt: string;
}

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
  return (
    <aside className="flex w-full flex-col gap-2 border-b border-border bg-white p-3 md:w-64 md:border-r md:border-b-0">
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-foreground text-sm font-medium text-background"
      >
        <Plus className="size-3.5" />
        New chat
      </button>
      <nav className="flex flex-col gap-1" aria-label="Coach chats">
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            aria-current={activeId === thread.id ? "page" : undefined}
            onClick={() => onSelect(thread.id)}
            className={cn(
              "truncate rounded-xl px-3 py-2 text-left text-sm",
              activeId === thread.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            {thread.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
