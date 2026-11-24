"use client";

import type { ReactNode } from "react";
import { assetById, type Region, type Timeline, type TimelineItem, type Transform } from "@/lib/editor/schema";
import { browserAssetUrl } from "@/lib/editor/asset-url";
import { coverFrame } from "@/lib/editor/framing";
import { focusPosition, regionBoxStyle, textBoxStyle } from "@/lib/editor/layout-box";
import { dimensionsFor, FPS } from "@/lib/video/schema";
import { CaptionText } from "./composition/caption-text";
import { ScrubStill } from "./composition/scrub-still";
import { useEditorPlayback, useEditorTimeline, useHoverFrame } from "./editor-provider";

const layerStyle = (transform: Transform, opacity: number) => ({
  position: "absolute" as const,
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity,
  transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
});

const visibleItems = (timeline: Timeline, playheadFrame: number) => {
  const visible: TimelineItem[] = [];
  for (const track of timeline.tracks) {
    if (track.hidden) continue;
    for (const item of track.items) {
      if (playheadFrame < item.from || playheadFrame >= item.from + item.durationInFrames) continue;
      visible.push(item);
    }
  }
  return visible;
};

const scrubVideoId = (timeline: Timeline, item: TimelineItem) => {
  if (item.kind !== "video") return null;
  const asset = assetById(timeline, item.assetId);
  return asset?.source.type === "video" ? asset.source.videoId : null;
};

export function ScrubOverlay() {
  const timeline = useEditorTimeline();
  const { playheadFrame, isPlaying } = useEditorPlayback();
  const hoverFrame = useHoverFrame();
  if (isPlaying) return null;
  const previewFrame = hoverFrame ?? playheadFrame;
  const items = visibleItems(timeline, previewFrame);
  // Only legacy videos have scrub stills. Covering anything else would hide the paused player frame.
  if (items.some((item) => item.kind === "video" && !scrubVideoId(timeline, item))) return null;
  const frame = dimensionsFor(timeline.format);
  /** A layer in its region box, as the render draws it. */
  const placed = (item: { id: string; region?: Region; radius?: number }, layer: ReactNode) => {
    const box = regionBoxStyle(item, frame);
    return box ? (
      <div key={item.id} style={box}>
        {layer}
      </div>
    ) : (
      layer
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0C1222]" aria-hidden>
      {items.map((item) => {
        const localFrame = previewFrame - item.from;
        const asset = "assetId" in item ? assetById(timeline, item.assetId) : null;

        if (item.kind === "video") {
          const videoId = scrubVideoId(timeline, item);
          if (!videoId) return null;
          return placed(
            item,
            <div key={item.id} style={layerStyle(coverFrame(item.transform), item.opacity)}>
              <ScrubStill
                videoId={videoId}
                time={(item.trimStart + localFrame) / FPS}
                fit={item.transform.fit}
                position={focusPosition(item.focus)}
              />
            </div>,
          );
        }

        if (item.kind === "image") {
          const src = asset ? browserAssetUrl(asset) : null;
          if (!src) return null;
          return placed(
            item,
            <div key={item.id} style={layerStyle(item.transform, item.opacity)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: item.transform.fit,
                  ...(item.focus ? { objectPosition: focusPosition(item.focus) } : {}),
                }}
              />
            </div>,
          );
        }

        if (item.kind === "text") {
          return (
            <div key={item.id} style={layerStyle(item.transform, 1)}>
              <div style={textBoxStyle(item.style)}>
                <CaptionText item={item} frame={localFrame} />
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
