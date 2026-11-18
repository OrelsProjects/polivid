"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExpandableText } from "@/components/expandable-text";
import { ProgressFill } from "@/components/motion/motion";
import { JobHoldControls } from "@/components/job-hold-controls";
import { JobMoreMenu } from "@/components/job-more-menu";
import { JobStageList } from "@/components/job-stage-list";
import { VideoStage } from "@/components/video/video-stage";
import { DeleteVideoButton } from "@/components/delete-video-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiErrorMessage, apiErrorStatus, loginPath } from "@/lib/store/api-errors";
import { useCancelVideoMutation, useGetActiveJobsQuery } from "@/lib/store/endpoints/videos";
import { jobPhase, type PhaseTone } from "@/lib/video/job-phase";
import type { VideoJobView } from "@/lib/video/job-status";

const BADGE_TONE: Record<PhaseTone, string> = {
  idle: "bg-zinc-600",
  prep: "bg-sky-600",
  generate: "bg-amber-500",
  render: "bg-violet-600",
  attention: "bg-red-600",
};

const POLL_MS = 3000;

const jobIdsKey = (jobs: VideoJobView[]) => jobs.map((job) => job.id).join();

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const jobTitle = (prompt: string) => prompt.replace(/\s+/g, " ").trim() || "Untitled video";

const formatElapsed = (startedAt: string, now: number) => {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  const total = Math.max(0, Math.floor((now - start) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
};

export function ActiveJobCards({ initialJobs }: { initialJobs: VideoJobView[] }) {
  const router = useRouter();
  const { data: polledJobs } = useGetActiveJobsQuery(undefined, {
    pollingInterval: POLL_MS,
    refetchOnMountOrArgChange: true,
  });
  const jobs = polledJobs ?? initialJobs;
  const [cancelVideo, { isLoading: canceling, originalArgs: cancelArg }] = useCancelVideoMutation();
  const cancelingId = canceling ? cancelArg : null;
  const [cancelError, setCancelError] = useState<{ id: string; message: string } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const idsRef = useRef(jobIdsKey(initialJobs));
  const idsKey = jobIdsKey(jobs);
  const hasRunning = jobs.some((job) => job.status === "running");

  useEffect(() => {
    if (idsRef.current === idsKey) return;
    idsRef.current = idsKey;
    router.refresh();
  }, [idsKey, router]);

  useEffect(() => {
    if (!hasRunning) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hasRunning]);

  const handleCancel = async (jobId: string) => {
    if (cancelingId) return;
    setCancelError(null);
    try {
      await cancelVideo(jobId).unwrap();
    } catch (error) {
      if (apiErrorStatus(error) === 401) {
        router.push(loginPath("/videos"));
        return;
      }
      setCancelError({ id: jobId, message: apiErrorMessage(error, "Couldn't cancel the video.") });
    }
  };

  if (jobs.length === 0) return null;

  return (
    <>
      {jobs.map((job) => (
        <ActiveJobCard
          key={job.id}
          job={job}
          now={now}
          canceling={cancelingId === job.id}
          cancelError={cancelError?.id === job.id ? cancelError.message : null}
          onCancel={() => {
            void handleCancel(job.id);
          }}
        />
      ))}
    </>
  );
}

const ActiveJobCard = ({
  job,
  now,
  canceling,
  cancelError,
  onCancel,
}: {
  job: VideoJobView;
  now: number | null;
  canceling: boolean;
  cancelError: string | null;
  onCancel: () => void;
}) => {
  const title = jobTitle(job.prompt);
  const paused = job.status === "paused";
  const phase = jobPhase(job, now);
  const stepLabel = phase.headline;
  const meta = [job.format, job.length > 0 ? `${job.length}s` : null, formatDate(job.createdAt)]
    .filter((part) => part)
    .join(" · ");
  const elapsed = now !== null && job.status === "running" && job.startedAt ? formatElapsed(job.startedAt, now) : null;

  return (
    <article className="col-span-2 flex flex-col gap-2.5 sm:col-span-1" aria-label={`${stepLabel}: ${title}`}>
      <div className="relative flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 pt-14 pb-4 shadow-sm">
        <JobMoreMenu title={title} rows={job.details ?? []} />
        <span
          className={cn(
            "absolute top-3.5 right-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white transition-colors",
            BADGE_TONE[phase.tone],
          )}
        >
          {phase.badge}
        </span>
        <div className="flex flex-col items-center gap-3">
          {paused && job.outputUrl ? (
            <VideoStage
              src={`${job.outputUrl}?v=${encodeURIComponent(job.updatedAt)}`}
              fit="contain"
              className="aspect-[9/16] w-full rounded-2xl"
              title={`Clips filmed so far for ${title}`}
            />
          ) : (
            <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
          )}
          <div className="flex flex-col items-center gap-1 text-center" aria-live="polite">
            <p className="text-sm font-medium text-balance">{phase.headline}</p>
            {phase.detail ? <p className="text-xs text-balance text-muted-foreground">{phase.detail}</p> : null}
          </div>
          {paused ? null : (
            <>
          <JobStageList
            mode={job.mode}
            tier={job.tier}
            model={job.model}
            length={job.length}
            currentStep={job.currentStep}
            clipIndex={job.clipIndex ?? null}
            clipTotal={job.clipTotal ?? 1}
            clipsDone={job.clipsDone}
            songUrl={job.songUrl}
          />
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={job.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${title} progress`}
          >
            <ProgressFill value={job.progressPct} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{job.progressPct}%</span>
          {elapsed ? (
            <span className="text-xs text-muted-foreground tabular-nums" aria-label={`Elapsed ${elapsed}`}>
              Elapsed {elapsed}
            </span>
          ) : null}
            </>
          )}
          <Link
            href={`/videos/${job.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            aria-label={`See progress for ${title}`}
          >
            See progress
          </Link>
          {paused ? <JobHoldControls job={job} /> : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={canceling}
              aria-label={`Cancel ${title}`}
              aria-busy={canceling}
              onClick={onCancel}
            >
              {canceling ? "Canceling…" : "Cancel"}
            </Button>
            <DeleteVideoButton id={job.id} title={title} filming />
          </div>
          {cancelError ? (
            <p className="text-center text-xs text-destructive" role="alert">
              {cancelError}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="text-sm font-medium">
          <ExpandableText text={title} limit={80} placement="below" />
        </span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
    </article>
  );
};
