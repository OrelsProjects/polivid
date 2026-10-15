import { auth } from "@/auth";
import { getProjectForUser } from "@/lib/editor/projects";
import { timelineDurationInFrames } from "@/lib/editor/schema";
import { createQueuedVideoJob } from "@/lib/video/jobs";
import { FPS } from "@/lib/video/schema";
import { startVideoJob } from "@/lib/video/worker";

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to export this edit." }, { status: 401 });
  const { id } = await context.params;
  if (!PROJECT_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  const project = await getProjectForUser(userId, id);
  if (!project) return Response.json({ error: "Not found." }, { status: 404 });

  const length = Math.max(2, Math.round(timelineDurationInFrames(project.timeline) / FPS));
  try {
    const job = await createQueuedVideoJob(userId, {
      prompt: project.title,
      format: project.format,
      length,
      model: "editor",
      mode: "editor-export",
      projectId: project.id,
    });
    void startVideoJob(userId, job.id).catch((error) => {
      console.error("Edit export stopped", error);
    });
    return Response.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    console.error("Could not start the edit export", error);
    return Response.json({ error: "Couldn't start the export. Try again." }, { status: 500 });
  }
}
