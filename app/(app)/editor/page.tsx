import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewProjectButton } from "@/components/editor/new-project-button";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyProjects } from "@/lib/editor/projects";

export const metadata: Metadata = { title: "Editor" };

export default function EditorIndexPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Editor</h1>
          <p className="mt-1 text-sm text-muted-foreground">Timeline edits. The original video stays untouched.</p>
        </div>
        <NewProjectButton />
      </div>
      <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
        <ProjectGrid />
      </Suspense>
    </div>
  );
}

async function ProjectGrid() {
  const projects = await listMyProjects();
  if (projects.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
        No edits yet. Start a blank project or open a video and choose Edit in editor.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/editor/${project.id}`}
            className="flex flex-col gap-1 rounded-2xl border border-border bg-white p-4 shadow-sm hover:border-primary/40"
          >
            <span className="font-medium">{project.title}</span>
            <span className="text-xs text-muted-foreground">
              {project.format} · {new Date(project.updatedAt).toLocaleDateString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
