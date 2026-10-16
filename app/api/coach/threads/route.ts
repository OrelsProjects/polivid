import { auth } from "@/auth";
import { createCoachThread, listCoachThreads } from "@/lib/coach/store";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see chats." }, { status: 401 });
  const threads = await listCoachThreads(userId);
  return Response.json({
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updatedAt.toISOString(),
    })),
  });
}

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to start a chat." }, { status: 401 });
  const thread = await createCoachThread(userId);
  return Response.json({ id: thread.id, title: thread.title }, { status: 201 });
}
