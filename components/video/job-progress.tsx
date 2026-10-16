"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/back-link";
import { ExpandableText } from "@/components/expandable-text";
import { JobHoldControls } from "@/components/job-hold-controls";
import { JobMoreMenu } from "@/components/job-more-menu";
import { JobStageList } from "@/components/job-stage-list";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiErrorStatus, loginPath } from "@/lib/store/api-errors";
import { useCancelVideoMutation, useGetVideoJobQuery, videosApi } from "@/lib/store/endpoints/videos";
import { useAppSelector } from "@/lib/store/hooks";
import { isJobStep, type VideoJobView } from "@/lib/video/job-status";
import { STEP_LABEL } from "@/lib/video/job-stages";

const POLL_MS = 3000;

const refreshedJobs = new Set<string>();

const isOpenJob = (job: VideoJobView) =>
  job.status === "queued" || job.status === "running" || job.status === "paused";

/**
 * Polls a job that was still open when the page rendered, until it settles.
 * A job that was already settled is shown as rendered, so a stale cache entry
 * from an earlier visit never replaces it.
 */
const useLiveVideoJob = (initialJob: VideoJobView) => {
  const watch = isOpenJob(initialJob);
  const selectJob = useMemo(() => videosApi.endpoints.getVideoJob.select(initialJob.id), [initialJob.id]);
  const cachedJob = useAppSelector(selectJob).data;
  const job = watch && cachedJob ? cachedJob : initialJob;
  useGetVideoJobQuery(initialJob.id, {
    skip: !watch,
    pollingInterval: isOpenJob(job) ? POLL_MS : 0,
    refetchOnMountOrArgChange: true,
  });
  return job;
};

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

export function VideoJobProgress({ job: initialJob, createdLabel }: { job: VideoJobView; createdLabel: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelVideo, { isLoading: canceling }] = useCancelVideoMutation();
  const job = useLiveVideoJob(initialJob);
  const open = isOpenJob(job);

  useEffect(() => {
    if (job.status !== "succeeded" || refreshedJobs.has(job.id)) return;
    refreshedJobs.add(job.id);
    router.refresh();
  }, [job.id, job.status, router]);

  useEffect(() => {
    if (!open || !job.startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open, job.startedAt]);

  const handleCancel = async () => {
    if (canceling) return;
    setCancelError(null);
    try {
      await cancelVideo(job.id).unwrap();
      router.refresh();
    } catch (error) {
      if (apiErrorStatus(error) === 401) {
        router.push(loginPath(`/videos/${job.id}`));
        return;
      }
      setCancelError(apiErrorMessage(error, "Couldn't cancel the video."));
    }
  };

  const title = jobTitle(job.prompt);
  const paused = job.status === "paused";
  const stepLabel = paused ? "Paused" : isJobStep(job.currentStep) ? STEP_LABEL[job.currentStep] : "Starting";
  const elapsed = now !== null && job.status === "running" && job.startedAt ? formatElapsed(job.startedAt, now) : null;
  const meta = [job.format, job.length > 0 ? `${job.length}s` : null, createdLabel].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/videos">My videos</BackLink>
        <h1 className="text-3xl font-semibold tracking-tight text-balance [overflow-wrap:anywhere]">
          <ExpandableText text={title} limit={140} placement="below" />
        </h1>
        {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
      </div>

      {job.status === "failed" || job.status === "canceled" ? (
        <div className="relative flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 pt-14 pb-5 text-sm" role="alert">
          <JobMoreMenu title={title} rows={job.details ?? []} />
          <span className="flex items-center gap-2 font-medium text-destructive">
            <TriangleAlert className="size-4" aria-hidden />
            {job.status === "canceled" ? "This video was canceled" : "Couldn't make this video"}
          </span>
          {job.error ? (
            <span className="text-muted-foreground">
              <ExpandableText text={job.error} />
            </span>
          ) : null}
        </div>
      ) : (
        <section className="relative flex max-w-md flex-col gap-3 rounded-2xl border border-border bg-white px-6 pt-14 pb-8 shadow-sm">
          <JobMoreMenu title={title} rows={job.details ?? []} />
          <span className="absolute top-3.5 right-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
            {paused ? "PAUSED" : job.status === "queued" ? "STARTING" : job.status === "succeeded" ? "FINISHING" : "IN PROGRESS"}
          </span>
          <div className="flex flex-col items-center gap-3 text-center">
            {paused && job.outputUrl ? (
              <video
                src={`${job.outputUrl}?v=${encodeURIComponent(job.updatedAt)}`}
                controls
                playsInline
                preload="metadata"
                className="aspect-[9/16] w-full rounded-xl bg-black"
                aria-label={`Clips filmed so far for ${title}`}
              />
            ) : (
              <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
            )}
            <p className="sr-only" aria-live="polite">
              {job.status === "succeeded" ? "Finishing up" : stepLabel}
            </p>
            {paused ? null : (
              <>
            <JobStageList
              mode={job.mode}
              tier={job.tier}
              model={job.model}
              length={job.length}
              currentStep={job.status === "succeeded" ? "finalize" : job.currentStep}
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
              <div className="h-full rounded-full bg-primary" style={{ width: `${job.progressPct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{job.progressPct}%</span>
            {elapsed ? (
              <span className="text-xs text-muted-foreground tabular-nums" aria-label={`Elapsed ${elapsed}`}>
                Elapsed {elapsed}
              </span>
            ) : null}
              </>
            )}
            {paused ? (
              <p className="text-xs text-muted-foreground">
                Stopped after clip {job.clipsDone} of {job.clipTotal}. Continue films the rest.
              </p>
            ) : null}
            {job.currentStep === "videos" && !paused ? (
              <p className="text-xs text-muted-foreground">
                {job.mode === "lyrics" && job.clipTotal > 1
                  ? job.stopping
                    ? "Finishing the clips in progress, then stopping."
                    : `Filming ${job.clipsDone} of ${job.clipTotal} clips. This often takes a few minutes per clip.`
                  : job.stopping
                    ? `Finishing clip ${job.clipIndex ?? job.clipsDone + 1} of ${job.clipTotal}, then stopping.`
                    : job.clipIndex && job.clipTotal > 1
                      ? `Filming clip ${job.clipIndex} of ${job.clipTotal}. This often takes 20–30 minutes, and sometimes longer.`
                      : "Waiting on the video model. This often takes 20–30 minutes, and sometimes longer."}
              </p>
            ) : null}
            <JobHoldControls job={job} />
            {open ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={canceling}
                aria-label={`Cancel ${title}`}
                aria-busy={canceling}
                onClick={() => {
                  void handleCancel();
                }}
              >
                {canceling ? "Canceling…" : "Cancel"}
              </Button>
            ) : null}
            {cancelError ? (
              <p className="text-xs text-destructive" role="alert">
                {cancelError}
              </p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
