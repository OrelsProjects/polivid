import { auth } from "@/auth";
import { resumePausedVideoJob } from "@/lib/video/jobs";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Continues a paused video at the next clip. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to continue a video." }, { status: 401 });
  if (!JOB_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  try {
    const outcome = await resumePausedVideoJob(userId, id);
    if (outcome.result === "missing") return Response.json({ error: "Not found." }, { status: 404 });
    if (outcome.result === "finished") {
      return Response.json({ error: "This video is not paused." }, { status: 409 });
    }
    void import("@/lib/video/worker")
      .then(({ startVideoJob }) => startVideoJob(userId, id))
      .catch((error) => {
        console.error("Video stopped", error);
      });
    return Response.json({ status: "running" });
  } catch (error) {
    console.error("Could not resume video job", error);
    return Response.json({ error: "Couldn't continue this video. Try again." }, { status: 500 });
  }
}
