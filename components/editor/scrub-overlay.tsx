"use client";

import { assetById, type Timeline, type TimelineItem, type Transform } from "@/lib/editor/schema";
import { browserAssetUrl } from "@/lib/editor/asset-url";
import { coverFrame } from "@/lib/editor/framing";
import { FPS } from "@/lib/video/schema";
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

export function ScrubOverlay() {
  const timeline = useEditorTimeline();
  const { playheadFrame, isPlaying } = useEditorPlayback();
  const hoverFrame = useHoverFrame();
  if (isPlaying) return null;
  const previewFrame = hoverFrame ?? playheadFrame;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0C1222]" aria-hidden>
      {visibleItems(timeline, previewFrame).map((item) => {
        const localFrame = previewFrame - item.from;
        const asset = "assetId" in item ? assetById(timeline, item.assetId) : null;

        if (item.kind === "video") {
          const videoId = asset?.source.type === "video" ? asset.source.videoId : null;
          if (!videoId) return null;
          return (
            <div key={item.id} style={layerStyle(coverFrame(item.transform), item.opacity)}>
              <ScrubStill
                videoId={videoId}
                time={(item.trimStart + localFrame) / FPS}
                fit={item.transform.fit}
              />
            </div>
          );
        }

        if (item.kind === "image") {
          const src = asset ? browserAssetUrl(asset) : null;
          if (!src) return null;
          return (
            <div key={item.id} style={layerStyle(item.transform, item.opacity)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: item.transform.fit }}
              />
            </div>
          );
        }

        if (item.kind === "text") {
          return (
            <div key={item.id} style={layerStyle(item.transform, item.opacity)}>
              <div
                style={{
                  maxWidth: "86%",
                  padding: item.style.background ? "16px 28px" : 0,
                  background: item.style.background ?? "transparent",
                  color: item.style.color,
                  fontFamily: item.style.fontFamily,
                  fontSize: item.style.fontSize,
                  fontWeight: item.style.fontWeight,
                  textAlign: item.style.align,
                  lineHeight: 1.15,
                }}
              >
                {item.text}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
