import { auth } from "@/auth";
import { deleteVideoForUser, getVideoJobForUser } from "@/lib/video/jobs";
import { isVideoId } from "@/lib/video/media-store";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Owner-only progress for one video job. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see this video." }, { status: 401 });
  if (!JOB_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  const job = await getVideoJobForUser(userId, id);
  if (!job) return Response.json({ error: "Not found." }, { status: 404 });
  if (job.status === "queued" || job.status === "running") {
    void import("@/lib/video/worker")
      .then(({ startVideoJob }) => startVideoJob(userId, id))
      .catch((error) => {
        console.error("Could not resume this video", error);
      });
  }
  return Response.json(job);
}

/** Deletes one video the signed-in user owns, including its job and files. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to delete a video." }, { status: 401 });
  if (!isVideoId(id)) return Response.json({ error: "Not found." }, { status: 404 });

  try {
    const removed = await deleteVideoForUser(userId, id);
    if (!removed) return Response.json({ error: "Not found." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not delete the video", error);
    return Response.json({ error: "Couldn't delete the video. Try again." }, { status: 500 });
  }
}
