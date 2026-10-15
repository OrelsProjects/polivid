import type { Metadata } from "next";
import { ModeGallery } from "@/components/mode-gallery";

export const metadata: Metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground">Pick a way to make a video.</p>
      </div>
      <ModeGallery />
    </div>
  );
}
