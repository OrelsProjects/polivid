import { auth } from "@/auth";
import { deleteCoachThread, getCoachThread } from "@/lib/coach/store";

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see this chat." }, { status: 401 });
  const { threadId } = await context.params;
  const thread = await getCoachThread(userId, threadId);
  if (!thread) return Response.json({ error: "Chat not found." }, { status: 404 });
  return Response.json({
    id: thread.id,
    title: thread.title,
    messages: thread.messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts,
    })),
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to delete a chat." }, { status: 401 });
  const { threadId } = await context.params;
  const removed = await deleteCoachThread(userId, threadId);
  if (!removed) return Response.json({ error: "Chat not found." }, { status: 404 });
  return Response.json({ ok: true });
}
