import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hasFootage } from "@/lib/video/footage";
import type { VideoFormat } from "@/lib/video/schema";
import { getVideoForUser } from "@/lib/videos";
import { timelineFromVideo } from "./from-video";
import { emptyTimeline, TimelineSchema, type Timeline } from "./schema";
import type { EditProjectSummary, EditProjectView } from "./types";

export type { EditProjectSummary, EditProjectView } from "./types";

export class ProjectConflictError extends Error {
  constructor() {
    super("This project was saved from another tab.");
    this.name = "ProjectConflictError";
  }
}

const parseTimeline = (value: unknown): Timeline => {
  const parsed = TimelineSchema.safeParse(value);
  if (!parsed.success) throw new Error("This project has a broken timeline.");
  return parsed.data;
};

const toView = (row: {
  id: string;
  title: string;
  format: string;
  timeline: Prisma.JsonValue;
  version: number;
  sourceVideoId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EditProjectView => ({
  id: row.id,
  title: row.title,
  format: row.format as VideoFormat,
  timeline: parseTimeline(row.timeline),
  version: row.version,
  sourceVideoId: row.sourceVideoId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listProjectsForUser = async (userId: string): Promise<EditProjectSummary[]> => {
  const rows = await db.editProject.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, format: true, sourceVideoId: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    format: row.format as VideoFormat,
    sourceVideoId: row.sourceVideoId,
    updatedAt: row.updatedAt.toISOString(),
  }));
};

export const listMyProjects = async () => listProjectsForUser((await getCurrentUser()).id);

export const getProjectForUser = async (userId: string, id: string): Promise<EditProjectView | null> => {
  const row = await db.editProject.findFirst({ where: { id, userId } });
  return row ? toView(row) : null;
};

export const getMyProject = async (id: string) => getProjectForUser((await getCurrentUser()).id, id);

export const createBlankProjectForUser = async (userId: string, format: VideoFormat = "9:16") => {
  const timeline = emptyTimeline(format);
  const row = await db.editProject.create({
    data: {
      userId,
      title: "Untitled edit",
      format,
      timeline: timeline as unknown as Prisma.InputJsonValue,
    },
  });
  return toView(row);
};

export const createBlankProject = async (format: VideoFormat = "9:16") =>
  createBlankProjectForUser((await getCurrentUser()).id, format);

export const createProjectFromVideoForUser = async (userId: string, videoId: string) => {
  const video = await getVideoForUser(userId, videoId);
  if (!video || video.status !== "ready") return null;
  const timeline = timelineFromVideo(video, { hasFootage: hasFootage(video.id) });
  const row = await db.editProject.create({
    data: {
      userId,
      sourceVideoId: video.id,
      title: video.title,
      format: video.format,
      timeline: timeline as unknown as Prisma.InputJsonValue,
    },
  });
  return toView(row);
};

export const createProjectFromVideo = async (videoId: string) =>
  createProjectFromVideoForUser((await getCurrentUser()).id, videoId);

/** The latest edit of this video, or a new one when none exists yet. Null when the video is not ready. */
export const openProjectForVideoForUser = async (userId: string, videoId: string) => {
  const existing = await db.editProject.findFirst({
    where: { userId, sourceVideoId: videoId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return toView(existing);
  return createProjectFromVideoForUser(userId, videoId);
};

export const saveProjectForUser = async (
  userId: string,
  id: string,
  input: { timeline: Timeline; title: string; version: number },
): Promise<EditProjectView> => {
  const updated = await db.editProject.updateMany({
    where: { id, userId, version: input.version },
    data: {
      title: input.title.trim() || "Untitled edit",
      format: input.timeline.format,
      timeline: input.timeline as unknown as Prisma.InputJsonValue,
      version: input.version + 1,
    },
  });
  if (updated.count === 1) {
    const row = await db.editProject.findFirstOrThrow({ where: { id, userId } });
    return toView(row);
  }
  const exists = await db.editProject.findFirst({ where: { id, userId }, select: { id: true } });
  if (!exists) throw new Error("Not found.");
  throw new ProjectConflictError();
};

export const saveMyProject = async (id: string, input: { timeline: Timeline; title: string; version: number }) =>
  saveProjectForUser((await getCurrentUser()).id, id, input);

export const deleteProjectForUser = async (userId: string, id: string) => {
  const deleted = await db.editProject.deleteMany({ where: { id, userId } });
  return deleted.count === 1;
};

export const deleteMyProject = async (id: string) => deleteProjectForUser((await getCurrentUser()).id, id);

export const revertProjectForUser = async (userId: string, id: string): Promise<EditProjectView | null> => {
  const project = await db.editProject.findFirst({ where: { id, userId } });
  if (!project?.sourceVideoId) return null;
  const video = await getVideoForUser(userId, project.sourceVideoId);
  if (!video) return null;
  const timeline = timelineFromVideo(video, { hasFootage: hasFootage(video.id) });
  const row = await db.editProject.update({
    where: { id: project.id },
    data: {
      title: video.title,
      format: video.format,
      timeline: timeline as unknown as Prisma.InputJsonValue,
      version: project.version + 1,
    },
  });
  return toView(row);
};

export const revertMyProject = async (id: string) => revertProjectForUser((await getCurrentUser()).id, id);
