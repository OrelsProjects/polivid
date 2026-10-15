import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditorShell } from "@/components/editor/editor-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProject } from "@/lib/editor/projects";
import type { LibraryVideo } from "@/lib/editor/types";
import { hasFootage } from "@/lib/video/footage";
import { listMyVideos } from "@/lib/videos";

export const metadata: Metadata = { title: "Edit" };

export default function EditorProjectPage({ params }: PageProps<"/editor/[projectId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-svh rounded-none" />}>
      {params.then(({ projectId }) => (
        <EditorLoader projectId={projectId} />
      ))}
    </Suspense>
  );
}

async function EditorLoader({ projectId }: { projectId: string }) {
  const [project, videos] = await Promise.all([getMyProject(projectId), listMyVideos()]);
  if (!project) notFound();
  const library: LibraryVideo[] = await Promise.all(
    videos
      .filter((video) => video.status === "ready")
      .map(async (video) => ({
        id: video.id,
        title: video.title,
        format: video.format,
        length: video.length,
        hasFootage: await hasFootage(video.id),
      })),
  );
  return <EditorShell project={project} videos={library} />;
}
