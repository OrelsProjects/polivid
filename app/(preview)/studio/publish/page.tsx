import type { Metadata } from "next";
import { Suspense } from "react";
import { PublishView } from "@/components/studio/publish-view";
import { listStudioProjects } from "@/lib/studio/library";

export const metadata: Metadata = { title: "Publish" };

export default function StudioPublishPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Publish />
    </Suspense>
  );
}

async function Publish() {
  const projects = await listStudioProjects();
  const media = projects
    .filter((item) => item.k === "ready")
    .map((item) => ({
      title: item.title,
      meta: item.meta,
      version: "v1",
      href: `/api/videos/${item.id}/file`,
    }));
  return <PublishView media={media} />;
}
