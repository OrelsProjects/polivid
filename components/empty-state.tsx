import { Film } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white p-10 text-center">
      <Film className="size-6 text-muted-foreground" />
      <div className="text-sm text-muted-foreground">
        No videos yet. Type a topic to make your first one.
      </div>
      <Link href="/create" className={buttonVariants({ size: "sm" })}>
        Create a video
      </Link>
    </div>
  );
}
