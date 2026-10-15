import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ModeGallery } from "@/components/mode-gallery";

export const metadata: Metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground">Pick a way to make a video.</p>
      </div>
      <Link
        href="/productions"
        aria-label="Productions"
        className="flex cursor-pointer flex-col rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-sm"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700">
          <Sparkles className="absolute right-4 bottom-4 size-10 text-white/85 drop-shadow-sm" aria-hidden />
        </div>
        <span className="mt-3 block text-sm font-medium">Productions</span>
        <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
          Develop a script, plan shots, generate, and assemble a finished cut.
        </span>
      </Link>
      <ModeGallery />
    </div>
  );
}
