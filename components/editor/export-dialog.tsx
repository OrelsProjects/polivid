"use client";

import { skipToken } from "@reduxjs/toolkit/query";
import { Download, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { currentExportVideoId } from "@/lib/editor/export-mark";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useExportEditProjectMutation, useRememberEditExportMutation } from "@/lib/store/endpoints/editor";
import { useGetVideoJobQuery } from "@/lib/store/endpoints/videos";
import {
  useEditorActions,
  useEditorExportVersion,
  useEditorExportVideoId,
  useEditorProjectId,
  useEditorSaveStatus,
  useEditorTitle,
  useEditorVersion,
} from "./editor-provider";

const POLL_MS = 2000;

const fileName = (title: string) => {
  const cleaned = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${cleaned.replace(/\.mp4$/i, "") || "edit"}.mp4`;
};

const downloadHref = (videoId: string, title: string) => {
  const name = fileName(title);
  return `/api/videos/${videoId}/file?download=1&name=${encodeURIComponent(name)}`;
};

export function ExportDialog() {
  const projectId = useEditorProjectId();
  const version = useEditorVersion();
  const saveStatus = useEditorSaveStatus();
  const title = useEditorTitle();
  const exportVideoId = useEditorExportVideoId();
  const exportVersion = useEditorExportVersion();
  const { markExported } = useEditorActions();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderedVersion = useRef<number | null>(null);
  const rememberedJob = useRef<string | null>(null);
  const startingExport = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [exportProject, { isLoading: starting }] = useExportEditProjectMutation();
  const [rememberExport] = useRememberEditExportMutation();
  const { data: job } = useGetVideoJobQuery(open && jobId ? jobId : skipToken, { pollingInterval: POLL_MS });

  const running = pending || job?.status === "queued" || job?.status === "running" || job?.status === "paused";
  const finishedId = job?.status === "succeeded" ? jobId : null;
  const readyId = currentExportVideoId(
    { videoId: exportVideoId, version: exportVersion },
    version,
    saveStatus === "saved",
  );
  const downloadId = running ? null : (readyId ?? finishedId);
  const failed = job?.status === "failed";

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!jobId || job?.status !== "succeeded" || rememberedJob.current === jobId) return;
    rememberedJob.current = jobId;
    const started = renderedVersion.current;
    if (started != null) markExported({ videoId: jobId, version: started });
    let cancel = false;
    const run = async () => {
      try {
        const response = await fetch(`/api/editor/projects/${projectId}`, { cache: "no-store" });
        if (cancel || !response.ok) throw new Error("missing");
        const project = (await response.json()) as { exportVideoId?: unknown; exportVersion?: unknown };
        if (typeof project.exportVideoId === "string" && typeof project.exportVersion === "number") {
          const older = started != null && project.exportVersion < started;
          if (!older && !cancel) markExported({ videoId: project.exportVideoId, version: project.exportVersion });
          if (project.exportVideoId === jobId) return;
        }
      } catch {
        // The explicit remember call below covers a render the server has not marked yet.
      }
      if (cancel || started == null) return;
      try {
        const mark = await rememberExport({ id: projectId, videoId: jobId, version: started }).unwrap();
        if (!cancel) markExported(mark);
      } catch {
        // This session can still download the file that just finished.
      }
    };
    void run();
    return () => {
      cancel = true;
      if (rememberedJob.current === jobId) rememberedJob.current = null;
    };
  }, [job?.status, jobId, markExported, projectId, rememberExport]);

  const startRender = async () => {
    if (startingExport.current) return;
    startingExport.current = true;
    setError(null);
    setPending(true);
    renderedVersion.current = version;
    try {
      const result = await exportProject(projectId).unwrap();
      renderedVersion.current = result.resumed ? null : version;
      setJobId(result.jobId);
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't start the export."));
    } finally {
      startingExport.current = false;
      setPending(false);
    }
  };

  const openExport = () => {
    setError(null);
    setOpen(true);
    if (startingExport.current || running || readyId) return;
    startingExport.current = true;
    setPending(true);
    void (async () => {
      try {
        const response = await fetch(`/api/editor/projects/${projectId}`, { cache: "no-store" });
        if (response.ok) {
          const project = (await response.json()) as { exportVideoId?: unknown; exportVersion?: unknown };
          if (
            saveStatus === "saved" &&
            typeof project.exportVideoId === "string" &&
            project.exportVersion === version
          ) {
            markExported({ videoId: project.exportVideoId, version: project.exportVersion });
            return;
          }
        }
        renderedVersion.current = version;
        const result = await exportProject(projectId).unwrap();
        renderedVersion.current = result.resumed ? null : version;
        setJobId(result.jobId);
      } catch (cause) {
        setError(apiErrorMessage(cause, "Couldn't start the export."));
      } finally {
        startingExport.current = false;
        setPending(false);
      }
    })();
  };

  return (
    <>
      <Button type="button" size="sm" onClick={openExport} disabled={starting || pending}>
        Export
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-lg outline-none"
          >
            <h2 id="export-dialog-title" className="text-lg font-semibold">
              Export MP4
            </h2>
            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {!error && running && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {job ? `Rendering… ${job.progressPct}%` : "Starting the render…"}
              </p>
            )}
            {!running && failed && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {job?.error ?? "The export failed."}
              </p>
            )}
            {!running && downloadId && (
              <p className="mt-3 text-sm">
                {finishedId === downloadId ? "Export finished." : "This edit is already rendered."}{" "}
                <Link
                  href={`/videos/${downloadId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open the video
                </Link>
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {!running && downloadId && (
                <Button type="button" variant="outline" size="sm" onClick={() => void startRender()} disabled={starting}>
                  Render again
                </Button>
              )}
              {!running && downloadId && (
                <a href={downloadHref(downloadId, title)} download={fileName(title)} className={buttonVariants({ size: "sm" })}>
                  <Download data-icon="inline-start" />
                  Download
                </a>
              )}
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
