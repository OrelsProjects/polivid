import type { Metadata } from "next";
import { Suspense } from "react";
import { SourcesView } from "@/components/studio/sources-view";

export const metadata: Metadata = { title: "Sources" };

export default function StudioSourcesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#6B6A7B]">Loading…</p>}>
      <SourcesView />
    </Suspense>
  );
}
