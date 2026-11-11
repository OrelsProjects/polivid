"use client";

import { AudioLines, VolumeX } from "lucide-react";
import { patchTrack } from "@/lib/editor/operations";
import type { Timeline } from "@/lib/editor/schema";
import { useEditorActions } from "../editor-provider";
import { footageSoundTracks } from "./footage-sound";
import { LinkedVideoSound } from "./linked-video-sound";
import { TRACK_HEADER_WIDTH } from "./playhead";

export function SoundLane({
  timeline,
  zoom,
  onSeek,
}: {
  timeline: Timeline;
  zoom: number;
  onSeek: (frame: number) => void;
}) {
  const actions = useEditorActions();
  const tracks = footageSoundTracks(timeline);
  const muted = tracks.length > 0 && tracks.every((track) => track.muted);

  const handleLanePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    onSeek(Math.max(0, Math.round(x / zoom)));
  };

  const toggleMute = () => {
    let next = timeline;
    for (const track of tracks) next = patchTrack(next, track.id, { muted: !muted });
    actions.applyTimeline(next);
  };

  return (
    <div className="flex h-10 shrink-0 border-b border-border">
      <div
        className="flex shrink-0 flex-col items-center justify-center bg-surface"
        style={{ width: TRACK_HEADER_WIDTH }}
      >
        <button
          type="button"
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={toggleMute}
        >
          {muted ? <VolumeX className="size-3.5" /> : <AudioLines className="size-3.5" />}
        </button>
      </div>
      <div className="relative min-w-0 flex-1 bg-background" onPointerDown={handleLanePointerDown}>
        <LinkedVideoSound timeline={timeline} zoom={zoom} labeled />
      </div>
    </div>
  );
}
