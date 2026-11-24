import "server-only";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { db } from "@/lib/db";
import { getProjectForUser } from "@/lib/editor/projects";
import { timelineDurationInFrames } from "@/lib/editor/schema";
import { createQueuedVideoJob, EDITOR_EXPORT_MODEL } from "@/lib/video/jobs";
import { FPS } from "@/lib/video/schema";
import { kickVideoJob } from "@/lib/jobs/dispatch";
import { hasFootage } from "@/lib/video/footage";

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

/**
 * The video an edit was opened from, when the edit hasn't changed since (version 1) and that video has
 * its finished file. Exporting it would only render the same video again, so its file is used instead.
 */
const unchangedOriginal = async (userId: string, project: { version: number; sourceVideoId: string | null }) => {
  if (project.version !== 1 || !project.sourceVideoId) return null;
  const [video, job] = await Promise.all([
    db.video.findFirst({ where: { id: project.sourceVideoId, userId, status: "ready" }, select: { id: true } }),
    db.videoJob.findFirst({ where: { id: project.sourceVideoId, userId, status: "succeeded" }, select: { id: true } }),
  ]);
  if (!video || !job) return null;
  return (await hasFootage(video.id)) ? video.id : null;
};

/** Queues a render of an editor project the person owns. */
export const exportProjectFromInput = async (userId: string, projectId: string, options: { force?: boolean } = {}) => {
  if (!PROJECT_ID.test(projectId)) return { error: "Not found." };
  const project = await getProjectForUser(userId, projectId);
  if (!project) return { error: "Not found." };
  const active = await findActiveEditorExport(userId, project.id);
  if (active) return { jobId: active, resumed: true };
  const original = options.force ? null : await unchangedOriginal(userId, project);
  if (original) return { jobId: original, resumed: true, original: true };
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
    kickVideoJob(userId, job.id, "Edit export stopped");
    return { jobId: job.id, resumed: false };
  } catch (error) {
    console.error("Could not start the edit export", error);
    if (error instanceof InsufficientCreditsError) return { error: error.message };
    return { error: "Couldn't start the export. Try again." };
  }
};
