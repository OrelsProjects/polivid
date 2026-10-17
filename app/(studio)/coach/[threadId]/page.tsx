import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoachPage } from "@/components/coach/coach-page";
import { Skeleton } from "@/components/ui/skeleton";
import { ensureThreadProject } from "@/lib/coach/project";
import { getCoachThread, loadCoachMessages } from "@/lib/coach/store";
import { getProjectForUser } from "@/lib/editor/projects";
import { getCurrentUser } from "@/lib/session";
import { getVideoJobForUser } from "@/lib/video/jobs";

export const metadata: Metadata = { title: "Coach" };

export default function CoachThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-svh rounded-none" />}>
      <CoachThreadLoader params={params} />
    </Suspense>
  );
}

async function CoachThreadLoader({ params }: { params: Promise<{ threadId: string }> }) {
  const user = await getCurrentUser();
  const { threadId } = await params;
  const thread = await getCoachThread(user.id, threadId);
  if (!thread) notFound();
  const messages = await loadCoachMessages(user.id, threadId);
  const job = thread.videoJobId ? await getVideoJobForUser(user.id, thread.videoJobId) : null;
  let project = thread.editProjectId ? await getProjectForUser(user.id, thread.editProjectId) : null;
  if (!project && job?.status === "succeeded") project = await ensureThreadProject(user.id, threadId);
  return <CoachPage initialThreadId={threadId} initialMessages={messages} initialJob={job} initialProject={project} />;
}
