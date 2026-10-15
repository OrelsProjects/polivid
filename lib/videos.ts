import "server-only";
import type { Prisma, Video } from "@/generated/prisma/client";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { listActiveVideoJobs } from "./video/jobs";
import type { VideoJobView } from "./video/job-status";
import type {
  Fact,
  ScenePlan,
  SearchSource,
  SourcedQuote,
  VideoFormat,
  VideoRecord,
  VideoStatus,
} from "./video/schema";

/**
 * Video data access. Reads resolve the signed-in user themselves, so a caller
 * can never ask for someone else's videos by passing an id.
 */

/** Queued and running jobs for the signed-in user, newest first. */
export async function listMyActiveJobs(): Promise<VideoJobView[]> {
  const user = await getCurrentUser();
  return listActiveVideoJobs(user.id);
}

export async function listMyVideos(): Promise<VideoRecord[]> {
  const user = await getCurrentUser();
  const rows = await db.video.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function getVideoForUser(userId: string, id: string): Promise<VideoRecord | null> {
  const row = await db.video.findFirst({ where: { id, userId } });
  return row ? toRecord(row) : null;
}

export async function getMyVideo(id: string): Promise<VideoRecord | null> {
  const user = await getCurrentUser();
  return getVideoForUser(user.id, id);
}

/** Called from the generation pipeline, which already authenticated the user. */
export async function createVideo(userId: string, video: VideoRecord) {
  await db.video.create({
    data: {
      id: video.id,
      userId,
      prompt: video.prompt,
      format: video.format,
      length: video.length,
      status: video.status,
      title: video.title,
      facts: video.facts as unknown as Prisma.InputJsonValue,
      quotes: video.quotes as unknown as Prisma.InputJsonValue,
      plan: (video.plan ?? undefined) as Prisma.InputJsonValue | undefined,
      searchSources: video.searchSources as unknown as Prisma.InputJsonValue,
      unverifiedFactIds: video.unverifiedFactIds,
      model: video.model,
      demo: video.demo,
      error: video.error,
      parentVideoId: video.parentVideoId ?? null,
      editProjectId: video.editProjectId ?? null,
      createdAt: new Date(video.createdAt),
    },
  });
}

/** JSON columns are written only by createVideo, so their shapes are trusted. */
function toRecord(row: Video): VideoRecord {
  return {
    id: row.id,
    prompt: row.prompt,
    format: row.format as VideoFormat,
    length: row.length,
    status: row.status as VideoStatus,
    createdAt: row.createdAt.toISOString(),
    title: row.title,
    facts: row.facts as unknown as Fact[],
    quotes: row.quotes as unknown as SourcedQuote[],
    plan: (row.plan ?? null) as unknown as ScenePlan | null,
    searchSources: row.searchSources as unknown as SearchSource[],
    unverifiedFactIds: row.unverifiedFactIds,
    model: row.model,
    demo: row.demo,
    error: row.error,
    parentVideoId: row.parentVideoId,
    editProjectId: row.editProjectId,
  };
}
