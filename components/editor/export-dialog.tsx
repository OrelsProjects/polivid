"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { VideoJobView } from "@/lib/video/job-status";
import { useEditorState } from "./editor-provider";

export function ExportDialog() {
  const { projectId } = useEditorState();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<VideoJobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const handleExport = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    setOpen(true);
    try {
      const response = await fetch(`/api/editor/projects/${projectId}/export`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { jobId?: string; error?: string } | null;
      if (!response.ok || !body?.jobId) {
        setError(body?.error ?? "Couldn't start the export.");
        return;
      }
      setJobId(body.jobId);
    } catch {
      setError("Couldn't start the export.");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!jobId || !open) return;
    let stopped = false;
    const tick = async () => {
      const response = await fetch(`/api/videos/${jobId}`, { cache: "no-store" });
      if (!response.ok || stopped) return;
      const next = (await response.json()) as VideoJobView;
      setJob(next);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId, open]);

  const done = job?.status === "succeeded";
  const failed = job?.status === "failed";

  return (
    <>
      <Button type="button" size="sm" onClick={() => void handleExport()} disabled={starting}>
        Export
      </Button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Export video"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Export MP4</h2>
            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {!error && !done && !failed && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {job ? `Rendering… ${job.progressPct}%` : "Starting the render…"}
              </p>
            )}
            {failed && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {job?.error ?? "The export failed."}
              </p>
            )}
            {done && jobId && (
              <p className="mt-3 text-sm">
                Export finished.{" "}
                <Link href={`/videos/${jobId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  Open the new video
                </Link>
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
