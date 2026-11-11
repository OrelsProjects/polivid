import { auth } from "@/auth";
import { continueVideoWithModel } from "@/lib/video/jobs";
import { GENERATION_MODEL_IDS } from "@/lib/video/models";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Continues a video that paused for a model, using the model the person picked. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to continue a video." }, { status: 401 });
  if (!JOB_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { model?: unknown } | null;
  const modelId = typeof body?.model === "string" ? body.model : "";
  if (!(GENERATION_MODEL_IDS as readonly string[]).includes(modelId)) {
    return Response.json({ error: "Pick a video model." }, { status: 400 });
  }

  try {
    const outcome = await continueVideoWithModel(userId, id, modelId);
    if (outcome.result === "missing") return Response.json({ error: "Not found." }, { status: 404 });
    if (outcome.result === "invalid") return Response.json({ error: "Pick a video model." }, { status: 400 });
    if (outcome.result === "same") {
      return Response.json({ error: "Pick a different model. This one already failed." }, { status: 400 });
    }
    if (outcome.result === "format") {
      return Response.json({ error: `${outcome.name} does not film this shape.` }, { status: 400 });
    }
    if (outcome.result === "finished") {
      return Response.json({ error: "This video is not waiting for a model." }, { status: 409 });
    }
    void import("@/lib/video/worker")
      .then(({ startVideoJob }) => startVideoJob(userId, id))
      .catch((error) => {
        console.error("Video stopped", error);
      });
    return Response.json({ status: "running" });
  } catch (error) {
    console.error("Could not continue with another model", error);
    return Response.json({ error: "Couldn't continue this video. Try again." }, { status: 500 });
  }
}
