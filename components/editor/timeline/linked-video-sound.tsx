"use client";

import { VolumeX } from "lucide-react";
import { assetById, type Timeline, type VideoItem } from "@/lib/editor/schema";
import { formatTimecode } from "@/lib/editor/timecode";
import { FPS } from "@/lib/video/schema";
import { cn } from "@/lib/utils";
import { useEditorActions, useEditorSelection } from "../editor-provider";
import { ClipWaveform } from "./clip-waveform";

const videoClips = (timeline: Timeline) => {
  const clips: VideoItem[] = [];
  for (const track of timeline.tracks) {
    for (const item of track.items) {
      if (item.kind === "video") clips.push(item);
    }
  }
  return clips;
};

export function LinkedVideoSound({ timeline, zoom }: { timeline: Timeline; zoom: number }) {
  const selection = useEditorSelection();
  const actions = useEditorActions();

  return (
    <>
      {videoClips(timeline).map((item) => {
        const asset = assetById(timeline, item.assetId);
        const videoId = asset?.source.type === "video" ? asset.source.videoId : null;
        if (!videoId) return null;
        const width = Math.max(8, item.durationInFrames * zoom);
        const selected = selection?.itemId === item.id;
        const silent = item.volume === 0;

        return (
          <div
            key={`sound-${item.id}`}
            role="button"
            tabIndex={0}
            aria-label={`Sound for clip from ${formatTimecode(item.from)}`}
            aria-pressed={selected}
            className={cn(
              "absolute top-1 bottom-1 overflow-hidden rounded-md bg-primary text-left",
              selected && "ring-2 ring-primary-foreground",
              silent && "opacity-50",
            )}
            style={{ left: item.from * zoom, width }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const track = timeline.tracks.find((entry) => entry.items.some((clip) => clip.id === item.id));
              if (track) actions.select({ trackId: track.id, itemId: item.id });
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              const track = timeline.tracks.find((entry) => entry.items.some((clip) => clip.id === item.id));
              if (track) actions.select({ trackId: track.id, itemId: item.id });
            }}
          >
            <ClipWaveform
              videoId={videoId}
              startSeconds={item.trimStart / FPS}
              durationSeconds={item.durationInFrames / FPS}
              width={width}
            />
            {silent ? (
              <VolumeX className="pointer-events-none absolute top-1/2 left-1.5 size-3 -translate-y-1/2 text-white/80" />
            ) : null}
          </div>
        );
      })}
    </>
  );
}
