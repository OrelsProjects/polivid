"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExpandableText } from "@/components/expandable-text";
import { JobHoldControls } from "@/components/job-hold-controls";
import { JobMoreMenu } from "@/components/job-more-menu";
import { JobStageList } from "@/components/job-stage-list";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiErrorStatus, loginPath } from "@/lib/store/api-errors";
import { useCancelVideoMutation, useGetActiveJobsQuery } from "@/lib/store/endpoints/videos";
import { isJobStep, type VideoJobView } from "@/lib/video/job-status";
import { STEP_LABEL } from "@/lib/video/job-stages";

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
  const hasRunning = jobs.some((job) => job.status === "running" && job.startedAt);

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
  const stepLabel = paused ? "Paused" : isJobStep(job.currentStep) ? STEP_LABEL[job.currentStep] : "Starting";
  const meta = [job.format, job.length > 0 ? `${job.length}s` : null, formatDate(job.createdAt)]
    .filter((part) => part)
    .join(" · ");
  const elapsed = now !== null && job.status === "running" && job.startedAt ? formatElapsed(job.startedAt, now) : null;

  return (
    <article className="col-span-2 flex flex-col gap-2.5 sm:col-span-1" aria-label={`${stepLabel}: ${title}`}>
      <div className="relative flex flex-col gap-3 rounded-2xl border border-border bg-white px-4 pt-14 pb-4 shadow-sm">
        <JobMoreMenu title={title} rows={job.details ?? []} />
        <span className="absolute top-3.5 right-3 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
          {paused ? "PAUSED" : job.status === "queued" ? "STARTING" : "IN PROGRESS"}
        </span>
        <div className="flex flex-col items-center gap-3">
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
            {stepLabel}
          </p>
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
            <p className="text-center text-xs text-muted-foreground">
              Stopped after clip {job.clipsDone} of {job.clipTotal}. Continue films the rest.
            </p>
          ) : null}
          {job.currentStep === "videos" && !paused ? (
            <p className="text-center text-xs text-muted-foreground">
              {job.mode === "lyrics" && job.clipTotal > 1
                ? job.stopping
                  ? "Finishing the clips in progress, then stopping. "
                  : `Filming ${job.clipsDone} of ${job.clipTotal} clips. `
                : job.stopping
                  ? `Finishing clip ${job.clipIndex ?? job.clipsDone + 1} of ${job.clipTotal}, then stopping. `
                  : job.clipIndex && job.clipTotal > 1
                    ? `Filming clip ${job.clipIndex} of ${job.clipTotal}. `
                    : "Waiting on the video model. "}
              {job.stopping ? "" : "This often takes 20–30 minutes, and sometimes longer."}
            </p>
          ) : null}
          <JobHoldControls job={job} />
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
