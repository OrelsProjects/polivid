import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteVideoButton } from "@/components/delete-video-button";
import { BatchView } from "@/components/studio/batch-view";
import { ProjectView } from "@/components/studio/project-view";
import { VideoJobProgress } from "@/components/video/job-progress";
import { VideoPlayer } from "@/components/video/video-player";
import { RetryJobButton } from "@/components/studio/retry-job-button";
import { hasFootage } from "@/lib/video/footage";
import { formatDate } from "@/lib/video/format";
import { availableGenerationModelIds } from "@/lib/video/available-models";
import { getMyVideo, getMyVideoJob } from "@/lib/videos";
import type { VideoRecord } from "@/lib/video/schema";

export default function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-[#6B6A7B]">Loading…</p>}>
      <Project params={params} />
    </Suspense>
  );
}

async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "click-then-sleep") return <ProjectView variant="ready" />;
  if (id === "why-sleep-matters") return <ProjectView variant="recovery" />;
  if (id === "october-newsletter") return <BatchView />;

  const job = await getMyVideoJob(id);
  if (job && (job.status === "queued" || job.status === "running" || job.status === "paused")) {
    return (
      <VideoJobProgress
        job={job}
        createdLabel={formatDate(job.createdAt)}
        models={availableGenerationModelIds()}
      />
    );
  }

  const video = await getMyVideo(id);
  if (!video) notFound();
  const file = await hasFootage(video.id);
  return <FinishedVideo video={video} file={file} />;
}

function FinishedVideo({ video, file }: { video: VideoRecord; file: boolean }) {
  const failed = video.status === "failed" || !video.plan;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/studio/projects" className="text-[13px] font-medium text-[#4A23C9]">
        Projects
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-heading text-[32px] leading-tight font-semibold">{video.title}</h1>
          <p className="mt-1 text-[14px] text-[#6B6A7B]">
            {video.format} · {video.length}s · {video.demo ? "Sample data" : video.model}
            {failed && video.error ? ` · ${video.error}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {file ? (
            <a
              href={`/api/videos/${video.id}/file`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#5B2EE6] px-5 font-medium text-white"
            >
              <Download className="size-4" aria-hidden />
              Download MP4
            </a>
          ) : null}
          {failed ? <RetryJobButton id={video.id} /> : null}
          <DeleteVideoButton id={video.id} title={video.title} redirectTo="/studio/projects" />
        </div>
      </header>
      {video.plan ? (
        <VideoPlayer
          footageUrl={file ? `/api/videos/${video.id}/file` : undefined}
          format={video.format}
          plan={video.plan}
          facts={video.facts}
          quotes={video.quotes}
          demo={video.demo}
        />
      ) : file ? (
        <video src={`/api/videos/${video.id}/file`} controls className="max-h-[70vh] w-full rounded-2xl bg-black" />
      ) : (
        <p className="text-[14px] text-[#6B6A7B]">This video has no picture yet.</p>
      )}
      {video.plan ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {video.plan.scenes.map((scene, index) => (
            <li key={`${scene.type}-${index}`} className="rounded-[14px] border border-[#E4E4EC] bg-white px-4 py-3 text-[14px]">
              <span className="font-semibold">
                {index + 1} · {scene.type}
              </span>
              <span className="mt-1 block text-[#3F3D4F]">{scene.narration}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
