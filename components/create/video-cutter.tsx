"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Pause, Play, Redo2, RotateCcw, Scissors, Trash2, Undo2, Undo, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  clipClock,
  clipRangesProblem,
  cutTimeAt,
  keepsEverything,
  keptRanges,
  keptSeconds,
  moveEdge,
  playbackTime,
  sectionsFromRanges,
  splitAt,
  toggleSection,
  trimTo,
  wholeClip,
  type ClipRange,
  type ClipSection,
} from "@/lib/video/clip-edit";
import { cn } from "@/lib/utils";

/** Frames in the strip under the timeline. */
const THUMBNAILS = 12;
const NUDGE_SECONDS = 0.1;

type Drag =
  | { kind: "playhead" }
  | { kind: "edge"; index: number; base: ClipSection[] }
  | { kind: "trim"; side: "start" | "end"; base: ClipSection[] };

/** Frames spread across the video, drawn small for the timeline strip. */
const useFilmstrip = (src: string, duration: number) => {
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    const canvas = document.createElement("canvas");
    const run = async () => {
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("unreadable"));
        video.src = src;
      });
      const height = 72;
      canvas.height = height;
      canvas.width = Math.max(1, Math.round((video.videoWidth / Math.max(1, video.videoHeight)) * height));
      const context = canvas.getContext("2d");
      if (!context) return;
      for (let index = 0; index < THUMBNAILS && !cancelled; index += 1) {
        const time = Math.min(duration - 0.05, ((index + 0.5) / THUMBNAILS) * duration);
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          video.currentTime = Math.max(0, time);
        });
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL("image/jpeg", 0.6);
        if (!cancelled) setFrames((current) => [...current, frame]);
      }
    };
    run().catch(() => undefined);
    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [src, duration]);
  return frames;
};

/**
 * Loom-style cutting for an uploaded video. The timeline shows the whole video; the person splits it
 * at the playhead, removes what they don't want, trims the ends, and drags cuts. Preview plays only
 * what is kept. Saving returns the kept parts, or null for the whole video.
 */
export function VideoCutter({
  src,
  duration,
  initialRanges,
  minSeconds,
  maxSeconds,
  onSave,
  onClose,
}: {
  src: string;
  duration: number;
  initialRanges: ClipRange[] | null;
  minSeconds: number;
  maxSeconds: number;
  onSave: (ranges: ClipRange[] | null) => void;
  onClose: () => void;
}) {
  const start = useMemo(
    () => (initialRanges && initialRanges.length > 0 ? sectionsFromRanges(initialRanges, duration) : wholeClip(duration)),
    [initialRanges, duration],
  );
  const [sections, setSections] = useState<ClipSection[]>(start);
  const [past, setPast] = useState<ClipSection[][]>([]);
  const [future, setFuture] = useState<ClipSection[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const frames = useFilmstrip(src, duration);

  const ranges = useMemo(() => keptRanges(sections), [sections]);
  const kept = keptSeconds(ranges);
  const problem = clipRangesProblem(ranges, duration, minSeconds, maxSeconds);
  const whole = keepsEverything(ranges, duration);

  const commit = useCallback(
    (next: ClipSection[], base: ClipSection[] = sections) => {
      setPast((history) => [...history.slice(-49), base]);
      setFuture([]);
      setSections(next);
    },
    [sections],
  );

  const seek = useCallback((to: number) => {
    const clamped = Math.min(duration, Math.max(0, to));
    setTime(clamped);
    if (videoRef.current) videoRef.current.currentTime = clamped;
  }, [duration]);

  const undo = useCallback(() => {
    setPast((history) => {
      const previous = history[history.length - 1];
      if (!previous) return history;
      setFuture((later) => [sections, ...later]);
      setSections(previous);
      setSelected(null);
      return history.slice(0, -1);
    });
  }, [sections]);

  const redo = useCallback(() => {
    setFuture((later) => {
      const next = later[0];
      if (!next) return later;
      setPast((history) => [...history, sections]);
      setSections(next);
      setSelected(null);
      return later.slice(1);
    });
  }, [sections]);

  const split = useCallback(() => {
    const next = splitAt(sections, time);
    if (next.length !== sections.length) {
      commit(next);
      setSelected(next.findIndex((section) => section.start >= time - 0.001));
    }
  }, [sections, time, commit]);

  const toggleSelected = useCallback(() => {
    const index = selected ?? sections.findIndex((section) => time >= section.start && time < section.end);
    if (index < 0) return;
    const next = toggleSection(sections, index);
    if (next !== sections) commit(next);
    setSelected(null);
  }, [selected, sections, time, commit]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    const from = playbackTime(ranges, video.currentTime);
    video.currentTime = from ?? ranges[0]?.start ?? 0;
    void video.play();
  }, [ranges]);

  // While playing, skip what is removed and stop after the last kept part.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (!video) return;
      const now = video.currentTime;
      const next = playbackTime(ranges, now);
      if (next === null) {
        video.pause();
        video.currentTime = ranges[0]?.start ?? 0;
        setTime(video.currentTime);
        return;
      }
      if (next - now > 0.03) video.currentTime = next;
      setTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, ranges]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const mod = event.metaKey || event.ctrlKey;
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key.toLowerCase() === "s" && !mod) {
        event.preventDefault();
        split();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        toggleSelected();
      } else if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = (event.shiftKey ? 1 : NUDGE_SECONDS) * (event.key === "ArrowLeft" ? -1 : 1);
        seek(time + step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, split, toggleSelected, undo, redo, seek, time]);

  const timeAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(duration, Math.max(0, ((clientX - rect.left) / rect.width) * duration));
  };

  const beginDrag = (event: ReactPointerEvent, next: Drag) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag(next);
  };

  // Dragging anything on the timeline stops playback.
  useEffect(() => {
    if (drag) videoRef.current?.pause();
  }, [drag]);

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag) return;
    const at = timeAt(event.clientX);
    if (drag.kind === "playhead") seek(at);
    else if (drag.kind === "edge") setSections(moveEdge(drag.base, drag.index, at));
    else setSections(trimTo(drag.base, drag.side, at));
    if (drag.kind !== "playhead") seek(at);
  };

  const onPointerUp = () => {
    setDrag(null);
    if (drag && drag.kind !== "playhead") {
      setPast((history) => [...history.slice(-49), drag.base]);
      setFuture([]);
    }
  };

  const percent = (value: number) => `${(value / duration) * 100}%`;
  const firstKept = ranges[0];
  const lastKept = ranges[ranges.length - 1];
  const selectedSection = selected !== null ? sections[selected] : null;
  const atPlayhead = sections.find((section) => time >= section.start && time < section.end);
  const toggleTarget = selectedSection ?? atPlayhead ?? null;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Viewport className="night fixed inset-0 z-50 grid place-items-center p-3 text-foreground sm:p-6">
          <Dialog.Popup className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-xl outline-none sm:p-6">
            <Dialog.Close
              aria-label="Close the cutter"
              className="absolute top-4 right-4 grid size-10 cursor-pointer place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
            <div className="pr-12">
              <Dialog.Title className="text-xl font-semibold tracking-tight">Cut your video</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Keep up to {maxSeconds} seconds. Drag the ends to trim, or press Split at the playhead and remove the parts you
                don&apos;t want. Preview plays only what you keep.
              </Dialog.Description>
            </div>

            <div className="overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                src={src}
                playsInline
                preload="auto"
                onClick={togglePlay}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(event) => {
                  if (!playing) setTime(event.currentTarget.currentTime);
                }}
                className="mx-auto max-h-[42vh] w-full cursor-pointer object-contain"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="icon" onClick={togglePlay} aria-label={playing ? "Pause" : "Play what you keep"}>
                {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
              </Button>
              <span className="text-sm tabular-nums">
                {clipClock(cutTimeAt(ranges, time))} <span className="text-muted-foreground">/ {clipClock(kept)}</span>
              </span>
              <span
                className={cn(
                  "ml-auto rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
                  kept > maxSeconds + 0.05 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
                )}
                aria-live="polite"
              >
                Keeping {kept.toFixed(1)}s of {maxSeconds}s max
              </span>
            </div>

            <div
              ref={trackRef}
              className="relative h-[72px] cursor-pointer touch-none overflow-hidden rounded-xl bg-muted select-none"
              onPointerDown={(event) => {
                seek(timeAt(event.clientX));
                setSelected(null);
                beginDrag(event, { kind: "playhead" });
              }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              role="slider"
              aria-label="Timeline"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration * 10) / 10}
              aria-valuenow={Math.round(time * 10) / 10}
              aria-valuetext={clipClock(time)}
            >
              <div className="pointer-events-none absolute inset-0 flex">
                {frames.map((frame, index) => (
                  // eslint-disable-next-line @next/next/no-img-element -- frames drawn in the browser
                  <img key={index} src={frame} alt="" className="h-full min-w-0 flex-1 object-cover" />
                ))}
              </div>
              {sections.map((section, index) => (
                <button
                  key={`${section.start}-${section.end}`}
                  type="button"
                  aria-label={`${section.removed ? "Removed" : "Kept"} part from ${clipClock(section.start)} to ${clipClock(section.end)}${section.removed ? ". Select, then restore it." : ". Select, then remove it."}`}
                  aria-pressed={selected === index}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelected(index);
                    seek(Math.min(section.end - 0.01, Math.max(section.start, timeAt(event.clientX))));
                  }}
                  className={cn(
                    "absolute inset-y-0 cursor-pointer border-y-2 transition-colors",
                    section.removed
                      ? "border-transparent bg-black/70 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.08)_6px_12px)]"
                      : "border-primary/70 bg-transparent",
                    selected === index && "outline-2 outline-offset-[-2px] outline-white",
                  )}
                  style={{ left: percent(section.start), width: percent(section.end - section.start) }}
                >
                  {section.removed && (section.end - section.start) / duration > 0.12 ? (
                    <span className="pointer-events-none text-[11px] font-medium text-white/80">Removed</span>
                  ) : null}
                </button>
              ))}
              {sections.slice(0, -1).map((section, index) => {
                const atEdge = Math.abs(section.end - (firstKept?.start ?? -1)) < 0.001 || Math.abs(section.end - (lastKept?.end ?? -1)) < 0.001;
                if (atEdge) return null;
                return (
                  <span
                    key={`edge-${section.end}`}
                    role="separator"
                    aria-label={`Cut at ${clipClock(section.end)}. Drag to move it.`}
                    onPointerDown={(event) => beginDrag(event, { kind: "edge", index, base: sections })}
                    className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize"
                    style={{ left: percent(section.end) }}
                  >
                    <span className="absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-full bg-white shadow" />
                  </span>
                );
              })}
              {firstKept && lastKept
                ? (["start", "end"] as const).map((side) => (
                    <span
                      key={side}
                      role="separator"
                      aria-label={side === "start" ? "Start of what you keep. Drag to trim." : "End of what you keep. Drag to trim."}
                      onPointerDown={(event) => beginDrag(event, { kind: "trim", side, base: sections })}
                      className={cn(
                        "absolute inset-y-0 z-20 grid w-4 cursor-ew-resize place-items-center bg-primary",
                        side === "start" ? "rounded-l-xl" : "-translate-x-full rounded-r-xl",
                      )}
                      style={{ left: percent(side === "start" ? firstKept.start : lastKept.end) }}
                    >
                      <span className="h-6 w-0.5 rounded-full bg-primary-foreground/80" />
                    </span>
                  ))
                : null}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-1 bottom-0 z-30 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
                style={{ left: percent(time) }}
              >
                <span className="absolute -top-0.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-white" />
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={split} title="Split at the playhead (S)">
                <Scissors aria-hidden data-icon="inline-start" />
                Split
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={toggleSelected} disabled={!toggleTarget} title="Remove or restore the selected part (Delete)">
                {toggleTarget?.removed ? <Undo aria-hidden data-icon="inline-start" /> : <Trash2 aria-hidden data-icon="inline-start" />}
                {toggleTarget?.removed ? "Restore part" : "Remove part"}
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={undo} disabled={past.length === 0} aria-label="Undo" title="Undo (⌘Z)">
                <Undo2 aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={redo} disabled={future.length === 0} aria-label="Redo" title="Redo (⇧⌘Z)">
                <Redo2 aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  commit(wholeClip(duration));
                  setSelected(null);
                }}
                disabled={whole}
              >
                <RotateCcw aria-hidden data-icon="inline-start" />
                Start over
              </Button>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                Space plays · S splits · Delete removes · ←/→ nudge
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
              {problem ? (
                <p className="mr-auto text-sm text-destructive" role="alert">
                  {problem}
                </p>
              ) : (
                <p className="mr-auto text-sm text-muted-foreground">
                  {whole ? "Using the whole video." : `${ranges.length} ${ranges.length === 1 ? "part" : "parts"} kept, joined in order.`}
                </p>
              )}
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={Boolean(problem)}
                onClick={() => {
                  onSave(whole ? null : ranges);
                  onClose();
                }}
              >
                Use this cut
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
