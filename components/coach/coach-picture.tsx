"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pictureRetryLabel } from "@/lib/coach/picture-preview";
import type { VideoFormat } from "@/lib/video/schema";
import { cn } from "@/lib/utils";

export type PictureLibraryState = "add" | "adding" | "added";

export type CoachPictureActions = {
  library?: {
    state: PictureLibraryState;
    onAdd: () => void;
  };
  retry?: {
    label?: string;
    disabled?: boolean;
    onRetry: () => void | Promise<void>;
  };
  error?: string | null;
};

const SKELETON_FRAME: Record<VideoFormat, string> = {
  "1:1": "h-96 w-96 max-w-full",
  "9:16": "aspect-[9/16] h-96 max-w-full",
  "16:9": "aspect-video h-56 max-w-full",
};

function WorkingPicture({ src, label }: { src: string; label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="relative mt-2 w-fit max-w-full overflow-hidden rounded-2xl border border-border bg-muted"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- picture being worked on */}
      <img src={src} alt="" className="block max-h-96 max-w-full object-contain opacity-60" />
      <Skeleton aria-hidden className="pointer-events-none absolute inset-0 size-full rounded-none bg-white/15" />
    </div>
  );
}

/** In-progress and finished pictures in the coach. Edits stay on the source; new pictures use a skeleton. */
export function CoachPicture({
  phase,
  src,
  format = "1:1",
  label,
  actions,
}: {
  phase: "edit" | "generate" | "done";
  src?: string | null;
  format?: VideoFormat;
  label: string;
  /** Hover actions on a finished picture. */
  actions?: CoachPictureActions;
}) {
  const [retrying, setRetrying] = useState(false);

  if ((phase === "edit" || retrying) && src) {
    return <WorkingPicture src={src} label={retrying ? "Retrying picture" : label} />;
  }

  if (phase === "done" && src) {
    const library = actions?.library;
    const retry = actions?.retry;
    const libraryLabel = library?.state === "added" ? "In library" : library?.state === "adding" ? "Adding…" : "Add to library";
    return (
      <div className="mt-2 w-fit max-w-full">
        <div className="group relative w-fit max-w-full overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- upload result, same as other coach pictures */}
          <img src={src} alt={label} className="block max-h-96 max-w-full object-contain" />
          {library || retry ? (
            <div
              aria-live="polite"
              className="absolute inset-x-2 bottom-2 flex flex-wrap justify-center gap-1.5 opacity-100 transition-opacity sm:pointer-events-none sm:opacity-0 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100"
            >
              {library ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-pressed={library.state === "added"}
                  disabled={library.state !== "add"}
                  onClick={library.onAdd}
                  className={cn(
                    "h-8 rounded-full bg-popover/95 px-3 shadow-sm backdrop-blur-sm",
                    library.state === "added" && "disabled:opacity-100",
                  )}
                >
                  {library.state === "added" ? <Check aria-hidden className="size-3.5" /> : null}
                  {libraryLabel}
                </Button>
              ) : null}
              {retry ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={retry.disabled || library?.state === "adding"}
                  onClick={() => {
                    if (retry.disabled || library?.state === "adding") return;
                    setRetrying(true);
                    void Promise.resolve(retry.onRetry()).finally(() => setRetrying(false));
                  }}
                  className="h-8 rounded-full bg-popover/95 px-3 shadow-sm backdrop-blur-sm"
                >
                  {retry.label ?? pictureRetryLabel()}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {actions?.error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {actions.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("relative mt-2 overflow-hidden rounded-2xl border border-border", SKELETON_FRAME[format])}
    >
      <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
    </div>
  );
}
