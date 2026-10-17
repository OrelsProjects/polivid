import { Film } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
        <Film className="size-5" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No videos yet</p>
        <p className="text-sm text-muted-foreground">Type a topic to make your first one.</p>
      </div>
      <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-xl px-4")}>
        Create a video
      </Link>
    </div>
  );
}
