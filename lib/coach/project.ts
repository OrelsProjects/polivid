import "server-only";
import { getProjectForUser, openProjectForVideoForUser } from "@/lib/editor/projects";
import type { EditProjectView } from "@/lib/editor/types";
import { getVideoForUser } from "@/lib/videos";
import { getCoachThread, linkThreadProject } from "./store";

/** Opens the editor project for this chat's video, once that video is ready. Safe to call again. */
export const ensureThreadProject = async (userId: string, threadId: string): Promise<EditProjectView | null> => {
  const thread = await getCoachThread(userId, threadId);
  if (!thread) return null;
  if (thread.editProjectId) {
    const linked = await getProjectForUser(userId, thread.editProjectId);
    if (linked) return linked;
  }
  if (!thread.videoJobId) return null;
  const video = await getVideoForUser(userId, thread.videoJobId);
  if (!video || video.status !== "ready") return null;
  const project = await openProjectForVideoForUser(userId, video.id);
  if (!project) return null;
  await linkThreadProject(userId, threadId, project.id);
  return project;
};
