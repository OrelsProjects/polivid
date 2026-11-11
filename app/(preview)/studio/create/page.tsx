import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateView } from "@/components/studio/create-view";

export const metadata: Metadata = { title: "Create video" };

export default function StudioCreatePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CreateView />
    </Suspense>
  );
}
