import { z } from "zod";
import { auth } from "@/auth";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { retryCoachPicture, retryStoryboardFrame } from "@/lib/coach/retry-picture";

export const maxDuration = 300;

const Schema = z.object({
  messageId: z.string().trim().min(1).max(80),
  toolCallId: z.string().trim().min(1).max(200),
  /** Set to remake one frame of a storyboard instead of a single picture. */
  frameIndex: z.number().int().min(1).max(12).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to retry a picture." }, { status: 401 });

  const { threadId } = await context.params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Couldn't retry that picture." }, { status: 400 });

  try {
    if (parsed.data.frameIndex) {
      const made = await retryStoryboardFrame(
        userId,
        threadId,
        parsed.data.messageId,
        parsed.data.toolCallId,
        parsed.data.frameIndex,
      );
      if ("error" in made) return Response.json({ error: made.error }, { status: made.status });
      return Response.json(made);
    }
    const result = await retryCoachPicture(userId, threadId, parsed.data.messageId, parsed.data.toolCallId);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    console.error("Could not retry picture", error);
    return Response.json({ error: "Couldn't retry that picture." }, { status: 500 });
  }
};
