"use client";

import { Pause, Play, Scissors, SkipBack } from "lucide-react";
import { addTrack, splitItem } from "@/lib/editor/operations";
import { findItem, timelineDurationInFrames } from "@/lib/editor/schema";
import { formatClock } from "@/lib/editor/timecode";
import { useEditorActions, useEditorPlayback, useEditorSelection, useEditorTimeline } from "../editor-provider";
import { ZoomControl } from "./zoom-control";

export function TimelineTransport() {
  const timeline = useEditorTimeline();
  const selection = useEditorSelection();
  const { playheadFrame, isPlaying } = useEditorPlayback();
  const actions = useEditorActions();
  const durationInFrames = timelineDurationInFrames(timeline);
  const selected = selection ? findItem(timeline, selection.itemId) : null;
  const canSplit =
    !!selected &&
    playheadFrame > selected.item.from &&
    playheadFrame < selected.item.from + selected.item.durationInFrames;

  const handlePlay = () => {
    if (playheadFrame >= durationInFrames) actions.setPlayhead(0);
    actions.setPlaying(!isPlaying);
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-2">
      <button
        type="button"
        aria-label="Split clip at playhead"
        disabled={!canSplit}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
        onClick={() => {
          if (!selected) return;
          actions.applyTimeline(splitItem(timeline, selected.item.id, playheadFrame));
        }}
      >
        <Scissors className="size-3.5" aria-hidden />
        Split
      </button>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-md px-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        onClick={() => actions.applyTimeline(addTrack(timeline, "visual"))}
      >
        + Video
      </button>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-md px-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        onClick={() => actions.applyTimeline(addTrack(timeline, "text"))}
      >
        + Text
      </button>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-md px-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        onClick={() => actions.applyTimeline(addTrack(timeline, "audio"))}
      >
        + Audio
      </button>

      <div className="flex flex-1 items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Go to start"
          className="inline-flex size-8 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
          onClick={() => {
            actions.setPlaying(false);
            actions.setPlayhead(0);
          }}
        >
          <SkipBack className="size-4" />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80"
          onClick={handlePlay}
        >
          {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
        </button>
        <span className="font-mono text-[11px] tabular-nums text-neutral-600">
          {formatClock(playheadFrame)}
          <span className="text-neutral-400"> / {formatClock(durationInFrames)}</span>
        </span>
      </div>

      <ZoomControl />
    </div>
  );
}
