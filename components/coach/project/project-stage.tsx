"use client";

import { Clapperboard } from "lucide-react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { useState } from "react";
import { JobHoldControls } from "@/components/job-hold-controls";
import { ProgressFill, useMotionSafe } from "@/components/motion/motion";
import { Button } from "@/components/ui/button";
import { ClipPreview } from "@/components/video/clip-preview";
import { ModelContinue } from "@/components/video/model-continue";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useCancelVideoMutation } from "@/lib/store/endpoints/videos";
import { STEP_LABEL } from "@/lib/video/job-stages";
import type { VideoJobView } from "@/lib/video/job-status";
import type { GenerationModelId } from "@/lib/video/models";

const PreviewPlayer = dynamic(() => import("@/components/editor/preview-player").then((module) => module.PreviewPlayer), {
  ssr: false,
});

const frameClass = (format: string) => {
  if (format === "16:9") return "aspect-video max-h-[40vh]";
  if (format === "1:1") return "aspect-square max-h-[38vh]";
  return "aspect-[9/16] max-h-[46vh]";
};

/** Width cap so the aspect ratio cannot grow taller than the stage. */
const previewCap = (format: string) => {
  if (format === "16:9") return "max-w-[min(100%,70vh)]";
  if (format === "1:1") return "max-w-[min(100%,38vh)]";
  return "max-w-[min(100%,26vh)]";
};

const drift = { duration: 7, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const };

/** Soft purple light drifting across the card while the footage is being made. */
function FilmingBackdrop({ animated }: { animated: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-primary/[0.06] via-card to-primary/[0.12]">
      <motion.div
        aria-hidden
        className="absolute -top-1/4 -left-1/3 size-4/5 rounded-full bg-primary/25 blur-3xl"
        animate={animated ? { x: ["0%", "70%", "20%"], y: ["0%", "40%", "90%"], scale: [1, 1.25, 0.95] } : undefined}
        transition={{ ...drift, duration: 9 }}
      />
      <motion.div
        aria-hidden
        className="absolute -right-1/3 -bottom-1/4 size-4/5 rounded-full bg-violet-400/25 blur-3xl"
        animate={animated ? { x: ["0%", "-60%", "-10%"], y: ["0%", "-50%", "-100%"], scale: [1.1, 0.9, 1.2] } : undefined}
        transition={{ ...drift, duration: 11 }}
      />
      {animated ? (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-primary/15 to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "260%" }}
          transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      ) : null}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative grid size-14 place-items-center">
          {animated ? (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/20"
              animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            />
          ) : null}
          <motion.span
            className="relative grid size-12 place-items-center rounded-full bg-card text-primary shadow-sm ring-1 ring-primary/15"
            animate={animated ? { scale: [1, 1.07, 1] } : undefined}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Clapperboard className="size-5" aria-hidden />
          </motion.span>
        </div>
      </div>
    </div>
  );
}

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

export function ProjectPlayer() {
  const safe = useMotionSafe();
  return (
    <motion.div
      className="flex min-h-0 flex-1"
      initial={safe ? { opacity: 0, scale: 0.98, filter: "blur(8px)" } : false}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={safe ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
    >
      <PreviewPlayer />
    </motion.div>
  );
}

export function ProjectRenderingStage({ job, models }: { job: VideoJobView; models?: readonly GenerationModelId[] }) {
  const safe = useMotionSafe();
  const [cancelVideo, { isLoading: canceling }] = useCancelVideoMutation();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const open = job.status === "queued" || job.status === "running" || job.status === "paused";
  const label = job.needsModel
    ? "Waiting for another model"
    : job.stalled
      ? "Not filming"
      : job.currentStep
        ? STEP_LABEL[job.currentStep]
        : job.status === "failed"
          ? "The video failed"
          : "Waiting to start";

  const handleCancel = async () => {
    try {
      await cancelVideo(job.id).unwrap();
    } catch (cause) {
      setCancelError(apiErrorMessage(cause, "Couldn't cancel that video."));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <motion.div
        className="m-auto flex w-full max-w-3xl flex-col items-center gap-4 p-6"
        initial={safe ? { opacity: 0, scale: 0.96 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={safe ? spring : { duration: 0 }}
      >
        {job.clips.some((clip) => clip.ready) ? (
          <div className={`w-full ${previewCap(job.format)}`}>
            <ClipPreview jobId={job.id} title={job.prompt} format={job.format} clips={job.clips} songUrl={job.songUrl} />
          </div>
        ) : (
          <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${frameClass(job.format)} ${previewCap(job.format)}`}>
            <FilmingBackdrop animated={safe} />
          </div>
        )}
        <div className="w-full max-w-md">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p>{label}</p>
            <p className="tabular-nums text-muted-foreground">{job.progressPct}%</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={job.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
            <ProgressFill value={job.progressPct} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {open ? <JobHoldControls job={job} /> : null}
          {open ? (
            <Button type="button" variant="outline" className="h-10" disabled={canceling} onClick={() => void handleCancel()}>
              Cancel
            </Button>
          ) : null}
        </div>
        {job.stalled ? (
          <p className="max-w-md text-center text-sm text-muted-foreground">
            This video is marked running, but nothing is working on it. This page tries again on its own.
          </p>
        ) : null}
        {job.needsModel ? <ModelContinue job={job} models={models} /> : job.error ? <p className="text-sm text-destructive">{job.error}</p> : null}
        {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}
      </motion.div>
    </div>
  );
}
