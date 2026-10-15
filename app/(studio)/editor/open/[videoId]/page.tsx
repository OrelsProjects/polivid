import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { openProjectForVideoForUser } from "@/lib/editor/projects";
import { getCurrentUser } from "@/lib/session";

export default function OpenVideoEditorPage({ params }: PageProps<"/editor/open/[videoId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-svh rounded-none" />}>
      {params.then(({ videoId }) => (
        <OpenVideoEditor videoId={videoId} />
      ))}
    </Suspense>
  );
}

async function OpenVideoEditor({ videoId }: { videoId: string }) {
  const user = await getCurrentUser();
  const project = await openProjectForVideoForUser(user.id, videoId);
  if (!project) return redirect(`/videos/${videoId}`);
  return redirect(`/editor/${project.id}`);
}
