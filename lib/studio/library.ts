import "server-only";
import { listActiveVideoJobs } from "@/lib/video/jobs";
import type { VideoJobView } from "@/lib/video/job-status";
import type { VideoRecord } from "@/lib/video/schema";
import { getCurrentUser } from "@/lib/session";
import { listMyVideos } from "@/lib/videos";

export type StudioKind = "ready" | "failed" | "rendering" | "draft" | "batch";
export type StudioFilter = "drafts" | "rendering" | "ready" | "failed" | "batches";

export type StudioProjectItem = {
  id: string;
  title: string;
  k: StudioKind;
  f: StudioFilter[];
  meta: string;
  href: string;
  thumbs: { ratio: string; bg: string; label: string }[];
  createdAt: string;
};

const ago = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return minutes < 1 ? "just now" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

const ratioClass = (format: string) => (format === "1:1" ? "aspect-square" : "aspect-[9/16]");

const jobCard = (job: VideoJobView): StudioProjectItem => {
  const open = job.status === "queued" || job.status === "running";
  const failed = job.status === "failed" || job.status === "paused" || job.needsModel;
  return {
    id: job.id,
    title: job.prompt.trim().slice(0, 80) || "Untitled video",
    k: open ? "rendering" : "failed",
    f: open ? ["rendering"] : ["failed"],
    meta: `Video · ${job.format} · ${job.length}s · ${open ? "rendering" : job.status}`,
    href: `/studio/projects/${job.id}`,
    thumbs: [
      {
        ratio: ratioClass(job.format),
        bg: open ? "bg-[#E6EEFC]" : "bg-[#FDE8EA]",
        label: open ? `${job.progressPct}%` : failed ? "failed" : job.status,
      },
    ],
    createdAt: job.createdAt,
  };
};

const videoCard = (video: VideoRecord): StudioProjectItem => {
  const failed = video.status === "failed" || !video.plan;
  const ready = !failed;
  return {
    id: video.id,
    title: video.title || video.prompt.slice(0, 80) || "Untitled video",
    k: failed ? "failed" : ready ? "ready" : "draft",
    f: failed ? ["failed"] : ["ready"],
    meta: `Video · ${video.format} · ${video.length}s · ${ready ? ago(video.createdAt) : video.error || "not finished"}`,
    href: `/studio/projects/${video.id}`,
    thumbs: [
      {
        ratio: ratioClass(video.format),
        bg: failed ? "bg-[#FDE8EA]" : "bg-[#DDEBFF]",
        label: failed ? "failed" : "v1",
      },
    ],
    createdAt: video.createdAt,
  };
};

export async function listStudioProjects(): Promise<StudioProjectItem[]> {
  const user = await getCurrentUser();
  const [videos, jobs] = await Promise.all([listMyVideos(), listActiveVideoJobs(user.id)]);
  const activeIds = new Set(jobs.map((job) => job.id));
  const cards = [...jobs.map(jobCard), ...videos.filter((video) => !activeIds.has(video.id)).map(videoCard)];
  cards.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return cards;
}
