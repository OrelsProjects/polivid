import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoachPage } from "@/components/coach/coach-page";
import { Skeleton } from "@/components/ui/skeleton";
import { getCoachThread, loadCoachMessages } from "@/lib/coach/store";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Coach" };

export default function CoachThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-[calc(100svh-4rem)] rounded-none" />}>
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
  return <CoachPage initialThreadId={threadId} initialMessages={messages} />;
}
