"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { isJobStep, type JobStep, type VideoJobView } from "@/lib/video/job-status";

const STEP_LABEL: Record<JobStep, string> = {
  script: "Writing the script",
  images: "Making the frames",
  videos: "Filming the scenes",
  render: "Stitching the video",
  finalize: "Finishing up",
};

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
  const [jobs, setJobs] = useState(initialJobs);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ id: string; message: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const idsRef = useRef(initialJobs.map((job) => job.id).join());
  const hasRunning = jobs.some((job) => job.status === "running" && job.startedAt);

  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRunning]);

  useEffect(() => {
    let stopped = false;

    const tick = async () => {
      const response = await fetch("/api/videos?status=active", { cache: "no-store" });
      if (!response.ok || stopped) return;
      const body = (await response.json().catch(() => null)) as { jobs?: VideoJobView[] } | null;
      if (!body?.jobs || stopped) return;
      const nextIds = body.jobs.map((job) => job.id).join();
      if (idsRef.current !== nextIds) {
        idsRef.current = nextIds;
        router.refresh();
      }
      setJobs(body.jobs);
    };

    void tick();
    const timer = setInterval(() => void tick(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router]);

  const handleCancel = async (jobId: string) => {
    if (cancelingId) return;
    setCancelingId(jobId);
    setCancelError(null);
    try {
      const response = await fetch(`/api/videos/${jobId}/cancel`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/videos")}`);
        return;
      }
      if (!response.ok) {
        throw new Error(body?.error ?? "Couldn't cancel the video.");
      }
      setJobs((current) => current.filter((job) => job.id !== jobId));
      idsRef.current = idsRef.current
        .split(",")
        .filter((id) => id && id !== jobId)
        .join();
      router.refresh();
    } catch (error) {
      setCancelError({
        id: jobId,
        message: error instanceof Error ? error.message : "Couldn't cancel the video.",
      });
    } finally {
      setCancelingId(null);
    }
  };

  if (jobs.length === 0) return null;

  return (
    <>
      {jobs.map((job) => {
        const title = jobTitle(job.prompt);
        const stepLabel = isJobStep(job.currentStep) ? STEP_LABEL[job.currentStep] : "Starting";
        const meta = [job.format, job.length > 0 ? `${job.length}s` : null, formatDate(job.createdAt)]
          .filter((part) => part)
          .join(" · ");
        const canceling = cancelingId === job.id;
        const elapsed = job.status === "running" && job.startedAt ? formatElapsed(job.startedAt, now) : null;

        return (
          <article key={job.id} className="flex flex-col gap-2.5" aria-label={`${stepLabel}: ${title}`}>
            <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl border border-border bg-white px-4 shadow-sm">
              <span className="absolute top-3 left-3 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                {job.status === "queued" ? "STARTING" : "IN PROGRESS"}
              </span>
              <div className="flex w-full flex-col items-center gap-3 text-center">
                <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-medium" aria-live="polite">
                  {stepLabel}
                </p>
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
                {elapsed && (
                  <span className="text-xs text-muted-foreground tabular-nums" aria-label={`Elapsed ${elapsed}`}>
                    Elapsed {elapsed}
                  </span>
                )}
                {job.currentStep === "videos" && (
                  <p className="text-xs text-muted-foreground">
                    Waiting on the video model. This often takes 20–30 minutes, and sometimes longer.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={canceling}
                  aria-label={`Cancel ${title}`}
                  aria-busy={canceling}
                  onClick={() => {
                    void handleCancel(job.id);
                  }}
                >
                  {canceling ? "Canceling…" : "Cancel"}
                </Button>
                {cancelError?.id === job.id && (
                  <p className="text-xs text-destructive" role="alert">
                    {cancelError.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 px-0.5">
              <span className="line-clamp-2 text-sm font-medium">{title}</span>
              <span className="text-xs text-muted-foreground">{meta}</span>
            </div>
          </article>
        );
      })}
    </>
  );
}
