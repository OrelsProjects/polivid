"use client";

import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX } from "lucide-react";
import { patchTrack } from "@/lib/editor/operations";
import type { Timeline, Track } from "@/lib/editor/schema";
import { cn } from "@/lib/utils";
import { useEditorActions } from "../editor-provider";
import { LinkedVideoSound } from "./linked-video-sound";
import { TRACK_HEADER_WIDTH } from "./playhead";
import { TimelineItemView } from "./timeline-item";

export function TimelineTrack({
  track,
  timeline,
  zoom,
  onSeek,
}: {
  track: Track;
  timeline: Timeline;
  zoom: number;
  onSeek: (frame: number) => void;
}) {
  const actions = useEditorActions();
  const tall = track.kind === "visual";
  const firstAudio = timeline.tracks.find((entry) => entry.kind === "audio");

  const handleLanePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    onSeek(Math.max(0, Math.round(x / zoom)));
  };

  return (
    <div className={cn("flex shrink-0 border-b border-border", tall ? "h-16" : track.kind === "audio" ? "h-10" : "h-8")}>
      <div
        className="flex shrink-0 flex-col items-center justify-center gap-0.5 bg-surface"
        style={{ width: TRACK_HEADER_WIDTH }}
      >
        {track.kind === "audio" ? (
          <button
            type="button"
            aria-label={track.muted ? "Unmute track" : "Mute track"}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => actions.applyTimeline(patchTrack(timeline, track.id, { muted: !track.muted }))}
          >
            {track.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        ) : (
          <button
            type="button"
            aria-label={track.hidden ? "Show track" : "Hide track"}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => actions.applyTimeline(patchTrack(timeline, track.id, { hidden: !track.hidden }))}
          >
            {track.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        {tall ? (
          <button
            type="button"
            aria-label={track.locked ? "Unlock track" : "Lock track"}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => actions.applyTimeline(patchTrack(timeline, track.id, { locked: !track.locked }))}
          >
            {track.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          </button>
        ) : null}
      </div>
      <div
        className="relative min-w-0 flex-1 bg-background"
        onPointerDown={handleLanePointerDown}
      >
        {track.items.length === 0 && track.kind !== "audio" ? (
          <div className="pointer-events-none absolute inset-x-2 inset-y-1 rounded-md bg-muted" />
        ) : null}
        {track.kind === "audio" && track.id === firstAudio?.id ? (
          <LinkedVideoSound timeline={timeline} zoom={zoom} />
        ) : null}
        {track.items.map((item) => (
          <TimelineItemView key={item.id} track={track} item={item} timeline={timeline} />
        ))}
      </div>
    </div>
  );
}
