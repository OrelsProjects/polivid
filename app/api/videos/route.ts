import { z } from "zod";
import { auth } from "@/auth";
import { enqueueVideoJob } from "@/lib/video/enqueue";
import { attachTriggerRun, createQueuedVideoJob, listActiveVideoJobs } from "@/lib/video/jobs";
import { startVideoWorker } from "@/lib/video/worker";
import { GENERATION_MODEL_IDS, generationModelById } from "@/lib/video/models";
import { MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH, VIDEO_FORMATS } from "@/lib/video/schema";

const CreateVideoSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  format: z.enum(VIDEO_FORMATS),
  length: z.number().int().min(MIN_VIDEO_LENGTH).max(MAX_VIDEO_LENGTH),
  model: z.enum(GENERATION_MODEL_IDS),
});

/**
 * Queues a video and returns immediately. The workflow engine does the work.
 * The browser reads progress from GET /api/videos/:id.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to generate videos." }, { status: 401 });

  const parsed = CreateVideoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const model = generationModelById(parsed.data.model);
  if (!model) return Response.json({ error: "Pick a generation model and try again." }, { status: 400 });

  try {
    const job = await createQueuedVideoJob(userId, {
      prompt: parsed.data.prompt,
      format: parsed.data.format,
      length: parsed.data.length,
      model: model.slug,
    });
    const triggerRunId = await enqueueVideoJob(job.id);
    if (triggerRunId) await attachTriggerRun(job.id, triggerRunId);
    return Response.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    console.error("Could not queue video job", error);
    return Response.json({ error: "Couldn't queue the video. Try again." }, { status: 500 });
  }
}

/** Active jobs for the signed-in user, so a fresh page can pick them up. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see your videos." }, { status: 401 });

  const status = new URL(request.url).searchParams.get("status");
  if (status !== "active") {
    return Response.json({ error: "Pass status=active." }, { status: 400 });
  }

  const jobs = await listActiveVideoJobs(userId);
  if (jobs.length > 0) {
    void startVideoWorker(userId).catch((error) => {
      console.error("Video worker stopped", error);
    });
  }
  return Response.json({ jobs });
}
