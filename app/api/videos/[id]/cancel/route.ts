import { auth } from "@/auth";
import { cancelVideoJobForUser } from "@/lib/video/jobs";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stops a queued or running job. A finished job stays as it is. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to cancel a video." }, { status: 401 });
  if (!JOB_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  try {
    const outcome = await cancelVideoJobForUser(userId, id);
    if (outcome.result === "missing") return Response.json({ error: "Not found." }, { status: 404 });
    if (outcome.result === "finished") {
      return Response.json({ error: "This video already finished." }, { status: 409 });
    }
    return Response.json({ status: "canceled" });
  } catch (error) {
    console.error("Could not cancel video job", error);
    return Response.json({ error: "Couldn't cancel the video. Try again." }, { status: 500 });
  }
}
