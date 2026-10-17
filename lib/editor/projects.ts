import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hasFootage } from "@/lib/video/footage";
import type { VideoFormat } from "@/lib/video/schema";
import { getVideoForUser } from "@/lib/videos";
import { nextExportMark } from "./export-mark";
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

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProjectRow = {
  id: string;
  userId: string;
  title: string;
  format: string;
  timeline: Prisma.JsonValue;
  version: number;
  sourceVideoId: string | null;
  exportVideoId: string | null;
  exportVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const toView = (row: ProjectRow): EditProjectView => ({
  id: row.id,
  title: row.title,
  format: row.format as VideoFormat,
  timeline: parseTimeline(row.timeline),
  version: row.version,
  sourceVideoId: row.sourceVideoId,
  exportVideoId: row.exportVideoId,
  exportVersion: row.exportVersion,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** A ready export made after the last save still matches this timeline. */
const latestUneditedExport = async (row: ProjectRow) => {
  const latest = await db.video.findFirst({
    where: { userId: row.userId, editProjectId: row.id, status: "ready" },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (!latest || latest.createdAt < row.updatedAt) return null;
  return latest.id;
};

/** Fills or clears the stored export so the editor can offer the finished file. */
const resolveExportMark = async (row: ProjectRow): Promise<ProjectRow> => {
  if (row.exportVideoId) {
    const video = await db.video.findFirst({
      where: { id: row.exportVideoId, userId: row.userId, editProjectId: row.id, status: "ready" },
      select: { id: true },
    });
    if (video) return row;
    await db.editProject.update({ where: { id: row.id }, data: { exportVideoId: null, exportVersion: null } });
    row = { ...row, exportVideoId: null, exportVersion: null };
  }
  const videoId = await latestUneditedExport(row);
  if (!videoId) return row;
  await db.editProject.update({
    where: { id: row.id },
    data: { exportVideoId: videoId, exportVersion: row.version },
  });
  return { ...row, exportVideoId: videoId, exportVersion: row.version };
};

/** Records the MP4 that a finished render produced, without replacing a newer cut. */
export const rememberProjectExport = async (userId: string, projectId: string, videoId: string, version: number) => {
  if (!ID.test(projectId) || !ID.test(videoId)) return null;
  const project = await db.editProject.findFirst({
    where: { id: projectId, userId },
    select: { exportVideoId: true, exportVersion: true },
  });
  if (!project) return null;
  const video = await db.video.findFirst({
    where: { id: videoId, userId, editProjectId: projectId, status: "ready" },
    select: { id: true },
  });
  if (!video) return null;
  const next = nextExportMark({ version: project.exportVersion }, { videoId, version });
  if (!next) {
    if (!project.exportVideoId || project.exportVersion == null) return null;
    return { videoId: project.exportVideoId, version: project.exportVersion };
  }
  if (project.exportVideoId !== next.videoId || project.exportVersion !== next.version) {
    await db.editProject.update({
      where: { id: projectId },
      data: { exportVideoId: next.videoId, exportVersion: next.version },
    });
  }
  return next;
};

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
  return row ? toView(await resolveExportMark(row)) : null;
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

export const createProjectFromTimelineForUser = async (
  userId: string,
  input: { title: string; format: VideoFormat; timeline: Timeline },
) => {
  const timeline = parseTimeline(input.timeline);
  const row = await db.editProject.create({
    data: {
      userId,
      title: input.title.trim() || "Untitled edit",
      format: input.format,
      timeline: timeline as unknown as Prisma.InputJsonValue,
    },
  });
  return toView(row);
};

export const createProjectFromVideoForUser = async (userId: string, videoId: string) => {
  const video = await getVideoForUser(userId, videoId);
  if (!video || video.status !== "ready") return null;
  const timeline = timelineFromVideo(video, { hasFootage: await hasFootage(video.id) });
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

/** Applies one timeline edit and saves it. Retries once when another save landed first. */
export const applyProjectEdit = async (
  userId: string,
  projectId: string,
  edit: (timeline: Timeline) => Timeline,
): Promise<EditProjectView> => {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await getProjectForUser(userId, projectId);
    if (!current) throw new Error("Not found.");
    try {
      return await saveProjectForUser(userId, projectId, {
        timeline: edit(current.timeline),
        title: current.title,
        version: current.version,
      });
    } catch (error) {
      last = error;
      if (!(error instanceof ProjectConflictError) || attempt === 1) throw error;
    }
  }
  throw last;
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
  const timeline = timelineFromVideo(video, { hasFootage: await hasFootage(video.id) });
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
