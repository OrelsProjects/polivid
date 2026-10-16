import { TypeValidationError } from "ai";
import { auth } from "@/auth";
import { runCoachTurn } from "@/lib/coach/run-turn";
import { getCoachThread } from "@/lib/coach/store";

export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to talk to the Coach." }, { status: 401 });
  const { threadId } = await context.params;
  const thread = await getCoachThread(userId, threadId);
  if (!thread) return Response.json({ error: "Chat not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { message?: unknown; timezone?: string } | null;
  if (!body?.message || typeof body.message !== "object") {
    return Response.json({ error: "Send a message." }, { status: 400 });
  }

  try {
    return await runCoachTurn({
      userId,
      threadId,
      message: body.message as never,
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    });
  } catch (error) {
    console.error("Coach turn failed", error);
    if (error instanceof TypeValidationError) {
      return Response.json(
        { error: "This chat hit a bad tool update. Refresh the page and approve the video again." },
        { status: 500 },
      );
    }
    const message = error instanceof Error ? error.message : "Couldn't run that turn.";
    return Response.json({ error: message }, { status: 500 });
  }
}
