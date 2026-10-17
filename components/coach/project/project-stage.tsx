"use client";

import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { useState } from "react";
import { JobHoldControls } from "@/components/job-hold-controls";
import { ProgressFill, useMotionSafe } from "@/components/motion/motion";
import { Button } from "@/components/ui/button";
import { ClipPreview } from "@/components/video/clip-preview";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useCancelVideoMutation } from "@/lib/store/endpoints/videos";
import { STEP_LABEL } from "@/lib/video/job-stages";
import type { VideoJobView } from "@/lib/video/job-status";

const PreviewPlayer = dynamic(() => import("@/components/editor/preview-player").then((module) => module.PreviewPlayer), {
  ssr: false,
});

const frameClass = (format: string) => {
  if (format === "16:9") return "aspect-video max-h-[48vh]";
  if (format === "1:1") return "aspect-square max-h-[48vh]";
  return "aspect-[9/16] max-h-[52vh]";
};

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

export function ProjectRenderingStage({ job }: { job: VideoJobView }) {
  const safe = useMotionSafe();
  const [cancelVideo, { isLoading: canceling }] = useCancelVideoMutation();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const open = job.status === "queued" || job.status === "running" || job.status === "paused";
  const label = job.currentStep ? STEP_LABEL[job.currentStep] : job.status === "failed" ? "The video failed" : "Waiting to start";

  const handleCancel = async () => {
    try {
      await cancelVideo(job.id).unwrap();
    } catch (cause) {
      setCancelError(apiErrorMessage(cause, "Couldn't cancel that video."));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
      <motion.div
        className="flex w-full max-w-3xl flex-col items-center gap-4"
        initial={safe ? { opacity: 0, scale: 0.96 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={safe ? spring : { duration: 0 }}
      >
        {job.clips.some((clip) => clip.ready) ? (
          <ClipPreview jobId={job.id} title={job.prompt} format={job.format} clips={job.clips} songUrl={job.songUrl} />
        ) : (
          <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${frameClass(job.format)}`}>
            <div className="absolute inset-0 bg-card">
              {safe ? (
                <motion.div
                  aria-hidden
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ["-100%", "220%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                />
              ) : null}
            </div>
          </div>
        )}
        <div className="w-full max-w-md">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p>{label}</p>
            <p className="text-muted-foreground">{job.progressPct}%</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <ProgressFill value={job.progressPct} />
          </div>
        </div>
        {job.clips.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Shots filmed so far">
            {job.clips.map((clip, index) => (
              <motion.li
                key={clip.index}
                initial={safe ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={safe ? { ...spring, delay: index * 0.06 } : { duration: 0 }}
                className={`h-14 w-10 rounded-md border border-border ${clip.ready ? "bg-primary/30" : "bg-muted"}`}
              />
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {open ? <JobHoldControls job={job} /> : null}
          {open ? (
            <Button type="button" variant="outline" className="h-10" disabled={canceling} onClick={() => void handleCancel()}>
              Cancel
            </Button>
          ) : null}
        </div>
        {job.error ? <p className="text-sm text-destructive">{job.error}</p> : null}
        {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}
      </motion.div>
    </div>
  );
}
