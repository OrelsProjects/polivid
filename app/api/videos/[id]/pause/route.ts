import { auth } from "@/auth";
import { requestStopAfterClip } from "@/lib/video/jobs";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Finishes the clip already filming, then stitches what is done and waits. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to pause a video." }, { status: 401 });
  if (!JOB_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  try {
    const outcome = await requestStopAfterClip(userId, id);
    if (outcome.result === "missing") return Response.json({ error: "Not found." }, { status: 404 });
    if (outcome.result === "single") {
      return Response.json({ error: "This video is one clip." }, { status: 409 });
    }
    if (outcome.result === "finished") {
      return Response.json({ error: "This video is not filming." }, { status: 409 });
    }
    return Response.json({ status: "stopping" });
  } catch (error) {
    console.error("Could not pause video job", error);
    return Response.json({ error: "Couldn't stop after this clip. Try again." }, { status: 500 });
  }
}
