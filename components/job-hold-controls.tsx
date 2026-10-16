"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiErrorStatus, loginPath } from "@/lib/store/api-errors";
import { usePauseVideoMutation, useResumeVideoMutation } from "@/lib/store/endpoints/videos";
import type { VideoJobView } from "@/lib/video/job-status";

const canStopAfterClip = (job: VideoJobView) =>
  job.status === "running" &&
  job.currentStep === "videos" &&
  job.clipTotal > 1 &&
  (job.clipIndex == null || job.clipIndex < job.clipTotal);

export const JobHoldControls = ({ job }: { job: VideoJobView }) => {
  const router = useRouter();
  const [pauseVideo, { isLoading: pausing }] = usePauseVideoMutation();
  const [resumeVideo, { isLoading: resuming }] = useResumeVideoMutation();
  const [error, setError] = useState<string | null>(null);
  const lyrics = job.mode === "lyrics" && job.clipTotal > 1;
  const stopping = job.stopping && job.status === "running";
  const showStop = canStopAfterClip(job) || stopping;
  const showContinue = job.status === "paused";

  const handleStop = async () => {
    if (pausing || stopping) return;
    setError(null);
    try {
      await pauseVideo(job.id).unwrap();
    } catch (caught) {
      if (apiErrorStatus(caught) === 401) {
        router.push(loginPath("/videos"));
        return;
      }
      setError(apiErrorMessage(caught, "Couldn't stop after this clip."));
    }
  };

  const handleContinue = async () => {
    if (resuming) return;
    setError(null);
    try {
      await resumeVideo(job.id).unwrap();
      router.refresh();
    } catch (caught) {
      if (apiErrorStatus(caught) === 401) {
        router.push(loginPath("/videos"));
        return;
      }
      setError(apiErrorMessage(caught, "Couldn't continue this video."));
    }
  };

  if (!showStop && !showContinue) return null;

  return (
    <>
      {showStop ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pausing || stopping}
          aria-label={lyrics ? `Stop ${job.prompt} after the clips in progress` : `Stop ${job.prompt} after this clip`}
          aria-busy={pausing || stopping}
          onClick={() => {
            void handleStop();
          }}
        >
          {pausing || stopping
            ? lyrics
              ? "Finishing clips in progress…"
              : "Finishing this clip…"
            : lyrics
              ? "Stop after clips in progress"
              : "Stop after this clip"}
        </Button>
      ) : null}
      {showContinue ? (
        <Button
          type="button"
          size="sm"
          disabled={resuming}
          aria-label={`Continue ${job.prompt}`}
          aria-busy={resuming}
          onClick={() => {
            void handleContinue();
          }}
        >
          {resuming ? "Continuing…" : "Continue"}
        </Button>
      ) : null}
      {error ? (
        <p className="text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
};
