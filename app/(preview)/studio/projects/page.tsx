import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsView } from "@/components/studio/projects-view";
import { listStudioProjects } from "@/lib/studio/library";

export const metadata: Metadata = { title: "Projects" };

export default function StudioProjectsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Projects />
    </Suspense>
  );
}

async function Projects() {
  const items = await listStudioProjects();
  return <ProjectsView items={items} />;
}
