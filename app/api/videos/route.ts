import { auth } from "@/auth";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { CreateVideoError, queueVideoFromInput } from "@/lib/video/create-request";
import { listActiveVideoJobs } from "@/lib/video/jobs";

/**
 * Queues a video and returns immediately. The workflow engine does the work.
 * The browser reads progress from GET /api/videos/:id.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to generate videos." }, { status: 401 });

  try {
    const { jobId } = await queueVideoFromInput(userId, await request.json().catch(() => null));
    return Response.json({ jobId }, { status: 202 });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    if (error instanceof CreateVideoError) {
      return Response.json({ error: error.message, issues: error.issues }, { status: error.status });
    }
    console.error("Could not start the video", error);
    return Response.json({ error: "Couldn't start the video. Try again." }, { status: 500 });
  }
}

/** Active jobs for the signed-in user, so a fresh page can pick them up. */
export async function GET(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: "Sign in to see your videos." }, { status: 401 });

    const status = new URL(request.url).searchParams.get("status");
    if (status !== "active") {
      return Response.json({ error: "Pass status=active." }, { status: 400 });
    }

    const jobs = await listActiveVideoJobs(userId);
    if (jobs.length > 0) {
      void import("@/lib/video/worker")
        .then(({ resumeOpenVideos }) => resumeOpenVideos(userId))
        .catch((error) => {
          console.error("Could not resume videos", error);
        });
    }
    return Response.json({ jobs });
  } catch (error) {
    console.error("Could not list videos", error);
    return Response.json({ error: "Couldn't load your videos. Try again." }, { status: 500 });
  }
}
