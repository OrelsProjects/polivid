"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { skipToken } from "@reduxjs/toolkit/query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useExportEditProjectMutation } from "@/lib/store/endpoints/editor";
import { useGetVideoJobQuery } from "@/lib/store/endpoints/videos";
import { useEditorProjectId } from "./editor-provider";

const POLL_MS = 2000;

export function ExportDialog() {
  const projectId = useEditorProjectId();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportProject, { isLoading: starting }] = useExportEditProjectMutation();
  const { data: job } = useGetVideoJobQuery(jobId && open ? jobId : skipToken, { pollingInterval: POLL_MS });

  const handleExport = async () => {
    if (starting) return;
    setError(null);
    setOpen(true);
    try {
      setJobId(await exportProject(projectId).unwrap());
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't start the export."));
    }
  };

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
