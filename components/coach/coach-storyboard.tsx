"use client";

import { RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { StoryboardFrameView } from "@/lib/coach/storyboard";
import type { VideoFormat } from "@/lib/video/schema";
import { cn } from "@/lib/utils";

const FRAME_CLASS: Record<VideoFormat, string> = {
  "9:16": "w-28",
  "1:1": "w-28",
  "16:9": "w-40",
};

const ASPECT_CLASS: Record<VideoFormat, string> = {
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "16:9": "aspect-video",
};

const rangeFor = (frames: readonly StoryboardFrameView[]) => {
  let start = 0;
  return frames.map((frame) => {
    const seconds = frame.seconds > 0 ? frame.seconds : 0;
    const end = start + seconds;
    const range = seconds > 0 ? `${start}–${end}s` : "";
    start = end;
    return range;
  });
};

export interface StoryboardRegenerate {
  /** The frame being made again, or null. */
  busyIndex: number | null;
  disabled: boolean;
  errorFor: (frameIndex: number) => string | null;
  onRegenerate: (frameIndex: number) => void | Promise<void>;
}

/** The scenes of a proposed video, one generated still each. */
export function CoachStoryboard({
  format,
  frames,
  working = false,
  failed = 0,
  regenerate,
}: {
  format: VideoFormat;
  frames: readonly StoryboardFrameView[];
  working?: boolean;
  failed?: number;
  /** Adds a Regenerate button under each finished frame. */
  regenerate?: StoryboardRegenerate;
}) {
  const ranges = rangeFor(frames);
  const shown = frames.length > 0 ? frames : working ? [{ index: 1, seconds: 0, beat: "" }] : [];
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openFrame = openIndex !== null ? shown[openIndex] : null;
  const openRange = openIndex !== null ? (ranges[openIndex] ?? "") : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openFrame && !dialog.open) dialog.showModal();
    if (!openFrame && dialog.open) dialog.close();
  }, [openFrame]);

  if (shown.length === 0) return null;

  const close = () => setOpenIndex(null);
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <section className="mt-3" aria-label={working ? "Making the storyboard" : "Storyboard"} aria-busy={working}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Storyboard</p>
      <ol className="mt-2 flex gap-6 overflow-x-auto overscroll-x-contain pb-1">
        {shown.map((frame, index) => {
          const range = ranges[index] ?? "";
          const label = `Scene ${frame.index}${range ? `, ${range}` : ""}`;
          return (
            <li key={`${frame.index}-${index}`} className={cn("shrink-0", FRAME_CLASS[format])}>
              <div className={cn("relative overflow-hidden rounded-xl border border-border bg-muted", ASPECT_CLASS[format])}>
                {regenerate?.busyIndex === frame.index ? (
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 z-10 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    style={{
                      animationName: "frame-sweep",
                      animationDuration: "1.6s",
                      animationTimingFunction: "ease-in-out",
                      animationIterationCount: "infinite",
                    }}
                  />
                ) : null}
                {frame.url && !working ? (
                  <button
                    type="button"
                    className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label={`View ${label} larger`}
                    onClick={() => setOpenIndex(index)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- storyboard still from the person's uploads */}
                    <img src={frame.url} alt="" className="size-full object-cover" />
                  </button>
                ) : working ? (
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    style={{
                      animationName: "frame-sweep",
                      animationDuration: "1.6s",
                      animationTimingFunction: "ease-in-out",
                      animationIterationCount: "infinite",
                      animationDelay: `${index * 0.28}s`,
                    }}
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">{range ? `${frame.index}. ${range}` : `Scene ${frame.index}`}</p>
              {frame.beat ? <p className="text-xs leading-snug text-foreground/80">{frame.beat}</p> : null}
              {regenerate && frame.url && !working ? (
                <>
                  <button
                    type="button"
                    disabled={regenerate.disabled || regenerate.busyIndex !== null}
                    onClick={() => void regenerate.onRegenerate(frame.index)}
                    className="mt-2 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={cn("size-3", regenerate.busyIndex === frame.index && "animate-spin")} aria-hidden />
                    {regenerate.busyIndex === frame.index ? "Regenerating" : "Regenerate"}
                  </button>
                  {regenerate.errorFor(frame.index) ? (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      {regenerate.errorFor(frame.index)}
                    </p>
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      {failed > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {failed === 1 ? "1 frame didn't come back." : `${failed} frames didn't come back.`} Ask me to redo those scenes.
        </p>
      ) : null}
      <dialog
        ref={dialogRef}
        aria-label={openFrame ? `Scene ${openFrame.index}` : "Storyboard still"}
        onClose={close}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/80"
      >
        {openFrame?.url ? (
          <div className="flex h-full w-full items-center justify-center p-6" onClick={handleBackdropClick}>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white outline-none hover:bg-black/70 focus-visible:ring-3 focus-visible:ring-white/70"
            >
              <X aria-hidden className="size-5" />
            </button>
            <figure className="flex max-h-full max-w-full flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- enlarged storyboard still */}
              <img
                src={openFrame.url}
                alt={openFrame.beat || `Scene ${openFrame.index}`}
                className="max-h-[min(80dvh,52rem)] max-w-[min(92vw,52rem)] rounded-xl object-contain"
              />
              <figcaption className="max-w-lg text-center text-sm text-white">
                <span className="font-medium">{openRange ? `${openFrame.index}. ${openRange}` : `Scene ${openFrame.index}`}</span>
                {openFrame.beat ? <span className="mt-1 block text-white/80">{openFrame.beat}</span> : null}
              </figcaption>
            </figure>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
