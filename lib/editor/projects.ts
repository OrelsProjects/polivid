import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getCharacter } from "@/lib/characters/store";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hasFootage, hasSourceFootage, hasVoiceLayer } from "@/lib/video/footage";
import { readJobInput } from "@/lib/video/job-status";
import type { VideoFormat } from "@/lib/video/schema";
import { getVideoForUser } from "@/lib/videos";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";
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

const voiceLayerName = async (userId: string, videoId: string) => {
  if (!(await hasVoiceLayer(videoId))) return null;
  const job = await db.videoJob.findFirst({
    where: { id: videoId, userId },
    select: { input: true },
  });
  const characterId = job ? readJobInput(job.input).characterId : "";
  if (characterId === STUDIO_VOICE_ID) return "Voiceover · Studio narrator";
  if (characterId && characterId !== OFF_VOICE_ID) {
    const character = await getCharacter(userId, characterId);
    if (character?.name) return `Voiceover · ${character.name}`;
  }
  return "Voiceover";
};

const footageOptions = async (userId: string, videoId: string) => {
  const [footage, source, voiceName] = await Promise.all([
    hasFootage(videoId),
    hasSourceFootage(videoId),
    voiceLayerName(userId, videoId),
  ]);
  return { hasFootage: footage, hasSource: source, voice: voiceName ? { name: voiceName } : null };
};

export const createProjectFromVideoForUser = async (userId: string, videoId: string) => {
  const video = await getVideoForUser(userId, videoId);
  if (!video || video.status !== "ready") return null;
  const timeline = timelineFromVideo(video, await footageOptions(userId, video.id));
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

/** Snapshots kept per project for undo. Older ones are dropped. */
export const MAX_REVISIONS = 50;

const recordRevision = async (project: EditProjectView, afterVersion: number, reason: string) => {
  await db.editProjectRevision.create({
    data: {
      projectId: project.id,
      version: project.version,
      afterVersion,
      title: project.title,
      format: project.timeline.format,
      timeline: project.timeline as unknown as Prisma.InputJsonValue,
      reason: reason.slice(0, 200),
    },
  });
  const stale = await db.editProjectRevision.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    skip: MAX_REVISIONS,
    select: { id: true },
  });
  if (stale.length > 0) await db.editProjectRevision.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
};

/**
 * Applies one timeline edit and saves it. Retries once when another save landed first.
 * With `reason`, the timeline before the edit is kept as a revision so it can be undone.
 */
export const applyProjectEdit = async (
  userId: string,
  projectId: string,
  edit: (timeline: Timeline) => Timeline,
  options: { title?: string; reason?: string } = {},
): Promise<EditProjectView> => {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await getProjectForUser(userId, projectId);
    if (!current) throw new Error("Not found.");
    try {
      const saved = await saveProjectForUser(userId, projectId, {
        timeline: edit(current.timeline),
        title: options.title ?? current.title,
        version: current.version,
      });
      if (options.reason) {
        await recordRevision(current, saved.version, options.reason).catch((error) => console.error("Could not keep a revision", error));
      }
      return saved;
    } catch (error) {
      last = error;
      if (!(error instanceof ProjectConflictError) || attempt === 1) throw error;
    }
  }
  throw last;
};

export const listRevisionsForUser = async (userId: string, projectId: string) => {
  const project = await db.editProject.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (!project) return null;
  const rows = await db.editProjectRevision.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, title: true, reason: true, createdAt: true },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
};

const restoreRow = async (
  userId: string,
  projectId: string,
  revision: { timeline: unknown; title: string },
  reason: string,
) => {
  const timeline = TimelineSchema.parse(revision.timeline);
  return applyProjectEdit(userId, projectId, () => timeline, { title: revision.title, reason });
};

/**
 * Puts back the timeline from before the newest agent edit, and forgets that revision.
 * Refuses when the project changed since then, so a person's later work is not thrown away.
 */
export const undoLastEditForUser = async (userId: string, projectId: string) => {
  const project = await getProjectForUser(userId, projectId);
  if (!project) return { result: "missing" as const };
  const latest = await db.editProjectRevision.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } });
  if (!latest) return { result: "empty" as const };
  if (project.version !== latest.afterVersion) return { result: "moved" as const, reason: latest.reason };
  const restored = await applyProjectEdit(userId, projectId, () => TimelineSchema.parse(latest.timeline), { title: latest.title });
  await db.editProjectRevision.delete({ where: { id: latest.id } }).catch(() => undefined);
  // The project now matches the state the previous edit saved, so that edit can be undone next.
  await db.editProjectRevision
    .updateMany({ where: { projectId, afterVersion: latest.version }, data: { afterVersion: restored.version } })
    .catch(() => undefined);
  return { result: "undone" as const, project: restored, reason: latest.reason };
};

/** Restores any kept revision. The current timeline becomes a revision too, so this can be undone. */
export const restoreRevisionForUser = async (userId: string, projectId: string, revisionId: string) => {
  const project = await db.editProject.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (!project) return null;
  const revision = await db.editProjectRevision.findFirst({ where: { id: revisionId, projectId } });
  if (!revision) return null;
  return restoreRow(userId, projectId, revision, `Restored the version from before “${revision.reason}”.`);
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
  const timeline = timelineFromVideo(video, await footageOptions(userId, video.id));
  await recordRevision(toView(project), project.version + 1, "Reverted to the original video.").catch((error) =>
    console.error("Could not keep a revision", error),
  );
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
