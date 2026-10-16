"use client";

import { moveItem, trimItem } from "@/lib/editor/operations";
import { snapCandidates, snapFrame } from "@/lib/editor/snapping";
import { assetById, type Timeline, type TimelineItem, type Track } from "@/lib/editor/schema";
import { formatTimecode } from "@/lib/editor/timecode";
import { browserAssetUrl } from "@/lib/editor/asset-url";
import { productionFilmstripUrl } from "@/lib/editor/filmstrip";
import { FPS } from "@/lib/video/schema";
import { cn } from "@/lib/utils";
import {
  useEditorActions,
  useEditorSelection,
  useEditorZoom,
  useGetEditorPlayback,
} from "../editor-provider";
import { ClipFilmstrip } from "./clip-filmstrip";
import { VideoFilmstrip } from "./video-filmstrip";

const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  video: "Video",
  image: "Image",
  scene: "Scene",
  text: "Text",
  audio: "Audio",
};

export function TimelineItemView({
  track,
  item,
  timeline,
}: {
  track: Track;
  item: TimelineItem;
  timeline: Timeline;
}) {
  const zoom = useEditorZoom();
  const selection = useEditorSelection();
  const getPlayback = useGetEditorPlayback();
  const actions = useEditorActions();
  const selected = selection?.itemId === item.id;
  const width = Math.max(8, item.durationInFrames * zoom);
  const asset = "assetId" in item ? assetById(timeline, item.assetId) : null;
  const videoId = item.kind === "video" && asset?.source.type === "video" ? asset.source.videoId : null;
  const filmstripSrc =
    item.kind === "video" && asset?.source.type === "production" ? productionFilmstripUrl(asset.source.assetId) : null;
  const imageSrc = item.kind === "image" && asset ? browserAssetUrl(asset) : null;
  const label = item.kind === "text" ? item.text : item.kind === "scene" ? item.scene.headline : KIND_LABEL[item.kind];

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, mode: "move" | "start" | "end") => {
    if (track.locked) return;
    event.stopPropagation();
    event.preventDefault();
    const node = event.currentTarget;
    node.setPointerCapture(event.pointerId);
    actions.select({ trackId: track.id, itemId: item.id });
    actions.beginGesture();
    const startX = event.clientX;
    const startFrom = item.from;
    const startEnd = item.from + item.durationInFrames;

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = Math.round((moveEvent.clientX - startX) / zoom);
      const candidates = snapCandidates(timeline, getPlayback().playheadFrame, [item.id]);
      if (mode === "move") {
        const from = snapFrame(Math.max(0, startFrom + delta), candidates, zoom);
        actions.updateTimeline(moveItem(timeline, item.id, from, track.id));
        return;
      }
      if (mode === "start") {
        const next = snapFrame(startFrom + delta, candidates, zoom);
        actions.updateTimeline(trimItem(timeline, item.id, "start", next));
        return;
      }
      const next = snapFrame(startEnd + delta, candidates, zoom);
      actions.updateTimeline(trimItem(timeline, item.id, "end", next));
    };
    const handleUp = () => {
      node.removeEventListener("pointermove", handleMove);
      node.removeEventListener("pointerup", handleUp);
      actions.endGesture();
    };
    node.addEventListener("pointermove", handleMove);
    node.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.kind} clip from ${formatTimecode(item.from)}`}
      aria-pressed={selected}
      className={cn(
        "absolute top-1 bottom-1 overflow-hidden rounded-lg text-left shadow-sm",
        item.kind === "video" || item.kind === "image" ? "bg-neutral-900" : null,
        item.kind === "text" && "bg-amber-400",
        item.kind === "audio" && "bg-primary",
        item.kind === "scene" && "bg-primary/80",
        selected && "ring-2 ring-primary",
        track.locked && "opacity-60",
      )}
      style={{ left: item.from * zoom, width }}
      onPointerDown={(event) => handlePointerDown(event, "move")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          actions.select({ trackId: track.id, itemId: item.id });
        }
      }}
    >
      {videoId && item.kind === "video" ? (
        <ClipFilmstrip
          videoId={videoId}
          startSeconds={item.trimStart / FPS}
          durationSeconds={item.durationInFrames / FPS}
          width={width}
        />
      ) : null}
      {filmstripSrc && item.kind === "video" ? (
        <VideoFilmstrip
          src={filmstripSrc}
          startSeconds={item.trimStart / FPS}
          durationSeconds={item.durationInFrames / FPS}
          width={width}
        />
      ) : null}
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : null}
      <span
        className={cn(
          "pointer-events-none absolute bottom-1 left-1.5 max-w-[calc(100%-12px)] truncate text-[10px] font-medium drop-shadow",
          item.kind === "text" ? "text-neutral-900" : "text-white",
        )}
      >
        {label}
      </span>
      <button
        type="button"
        aria-label="Trim start"
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize"
        onPointerDown={(event) => handlePointerDown(event, "start")}
      />
      <button
        type="button"
        aria-label="Trim end"
        className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize"
        onPointerDown={(event) => handlePointerDown(event, "end")}
      />
    </div>
  );
}
