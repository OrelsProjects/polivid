import { auth } from "@/auth";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { LayoutRequestError, queueLayoutStyle, quoteLayoutStyle } from "@/lib/video/layout/request";

const failure = (error: unknown) => {
  if (error instanceof LayoutRequestError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof InsufficientCreditsError) return Response.json({ error: error.message }, { status: 402 });
  console.error("Layout style request failed", error);
  return Response.json({ error: "Couldn't start the layout. Try again." }, { status: 500 });
};

/** What applying a layout style to this video would cost. Nothing is queued. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const quote = await quoteLayoutStyle(userId, id, await request.json().catch(() => null));
    return Response.json({ credits: quote.credits });
  } catch (error) {
    return failure(error);
  }
}

/** Applies a layout style to this finished video. The result is a new video with its own edit. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const queued = await queueLayoutStyle(userId, id, await request.json().catch(() => null));
    return Response.json(queued, { status: 202 });
  } catch (error) {
    return failure(error);
  }
}
