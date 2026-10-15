import { ChevronRight, Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewProjectButton } from "@/components/editor/new-project-button";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyProjects } from "@/lib/editor/projects";
import { formatDate } from "@/lib/video/format";

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
            className="group flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Clapperboard className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{project.title}</span>
              <span className="text-xs text-muted-foreground">
                {project.format} · Edited {formatDate(project.updatedAt)}
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
