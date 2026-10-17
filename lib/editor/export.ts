import "server-only";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { db } from "@/lib/db";
import { getProjectForUser } from "@/lib/editor/projects";
import { timelineDurationInFrames } from "@/lib/editor/schema";
import { createQueuedVideoJob, EDITOR_EXPORT_MODEL } from "@/lib/video/jobs";
import { FPS } from "@/lib/video/schema";
import { startVideoJob } from "@/lib/video/worker";

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The render already queued for this edit, so a second click does not start another. */
const findActiveEditorExport = async (userId: string, projectId: string) => {
  const jobs = await db.videoJob.findMany({
    where: { userId, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, input: true },
  });
  for (const job of jobs) {
    if (!job.input || typeof job.input !== "object" || Array.isArray(job.input)) continue;
    const input = job.input as { mode?: unknown; projectId?: unknown };
    if (input.mode === "editor-export" && input.projectId === projectId) return job.id;
  }
  return null;
};

/** Queues a render of an editor project the person owns. */
export const exportProjectFromInput = async (userId: string, projectId: string) => {
  if (!PROJECT_ID.test(projectId)) return { error: "Not found." };
  const project = await getProjectForUser(userId, projectId);
  if (!project) return { error: "Not found." };
  const active = await findActiveEditorExport(userId, project.id);
  if (active) return { jobId: active, resumed: true };
  const length = Math.max(2, Math.round(timelineDurationInFrames(project.timeline) / FPS));
  try {
    const job = await createQueuedVideoJob(userId, {
      prompt: project.title,
      format: project.format,
      length,
      model: EDITOR_EXPORT_MODEL,
      mode: "editor-export",
      projectId: project.id,
    });
    void startVideoJob(userId, job.id).catch((error) => {
      console.error("Edit export stopped", error);
    });
    return { jobId: job.id, resumed: false };
  } catch (error) {
    console.error("Could not start the edit export", error);
    if (error instanceof InsufficientCreditsError) return { error: error.message };
    return { error: "Couldn't start the export. Try again." };
  }
};
