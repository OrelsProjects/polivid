"use client";

import { useRef, type PointerEvent } from "react";
import { timelineDurationInFrames } from "@/lib/editor/schema";
import { cn } from "@/lib/utils";
import { useEditorActions, useEditorPlayback, useEditorTimeline, useEditorZoom } from "../editor-provider";
import { HoverLine, Playhead, TRACK_HEADER_WIDTH } from "./playhead";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack } from "./timeline-track";
import { TimelineTransport } from "./timeline-transport";

const PlaybackRuler = ({ durationInFrames, zoom }: { durationInFrames: number; zoom: number }) => {
  const { playheadFrame } = useEditorPlayback();
  const actions = useEditorActions();
  return (
    <TimelineRuler
      durationInFrames={durationInFrames}
      zoom={zoom}
      playheadFrame={playheadFrame}
      onSeek={(frame) => {
        actions.setPlaying(false);
        actions.setPlayhead(frame);
      }}
    />
  );
};

const PlaybackNeedle = ({ zoom }: { zoom: number }) => {
  const { playheadFrame } = useEditorPlayback();
  return <Playhead frame={playheadFrame} zoom={zoom} />;
};

export function TimelinePanel({ className }: { className?: string } = {}) {
  const timeline = useEditorTimeline();
  const zoom = useEditorZoom();
  const actions = useEditorActions();
  const { setHoverFrame } = actions;
  const contentRef = useRef<HTMLDivElement>(null);
  const durationInFrames = timelineDurationInFrames(timeline);
  const pictureTracks = timeline.tracks.filter((track) => track.kind !== "audio").reverse();
  const audioTracks = timeline.tracks.filter((track) => track.kind === "audio");
  const tracks = [...pictureTracks, ...audioTracks];

  const handleSeek = (frame: number) => {
    actions.setPlaying(false);
    actions.setPlayhead(frame);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const content = contentRef.current;
    if (event.pointerType !== "mouse" || !content) return;
    const x = event.clientX - content.getBoundingClientRect().left - TRACK_HEADER_WIDTH;
    setHoverFrame(x < 0 ? null : Math.round(x / zoom));
  };

  const handlePointerLeave = () => setHoverFrame(null);

  return (
    <section className={cn("flex h-72 shrink-0 flex-col border-t border-border bg-surface", className)}>
      <TimelineTransport />
      <div
        className="min-h-0 flex-1 overflow-auto"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div
          ref={contentRef}
          className="relative min-w-full"
          style={{ width: TRACK_HEADER_WIDTH + durationInFrames * zoom }}
        >
          <div className="sticky top-0 z-20 flex bg-surface">
            <div className="shrink-0" style={{ width: TRACK_HEADER_WIDTH }} />
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <PlaybackRuler durationInFrames={durationInFrames} zoom={zoom} />
            </div>
          </div>
          <div className="relative">
            {tracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                timeline={timeline}
                zoom={zoom}
                onSeek={handleSeek}
              />
            ))}
          </div>
          <HoverLine zoom={zoom} />
          <PlaybackNeedle zoom={zoom} />
        </div>
      </div>
    </section>
  );
}
