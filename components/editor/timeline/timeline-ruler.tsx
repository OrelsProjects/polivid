"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { FPS } from "@/lib/video/schema";

export function TimelineRuler({
  durationInFrames,
  zoom,
  playheadFrame,
  onSeek,
}: {
  durationInFrames: number;
  zoom: number;
  playheadFrame: number;
  onSeek: (frame: number) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [spanFrames, setSpanFrames] = useState(durationInFrames);
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const measure = () => {
      setSpanFrames(Math.max(durationInFrames, Math.ceil(node.clientWidth / zoom)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [durationInFrames, zoom]);

  const major = zoom >= 2.5 ? FPS : zoom >= 1.5 ? FPS * 2 : FPS * 5;
  const marks = [];
  for (let frame = 0; frame <= spanFrames; frame += major) marks.push(frame);
  const minors = [];
  if (zoom >= 4) {
    for (let frame = 0; frame <= spanFrames; frame += Math.round(FPS / 4)) {
      if (frame % major !== 0) minors.push(frame);
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    node.setPointerCapture(event.pointerId);
    const seek = (clientX: number) => {
      const x = clientX - node.getBoundingClientRect().left;
      onSeek(Math.max(0, Math.round(x / zoom)));
    };
    seek(event.clientX);
    const handleMove = (moveEvent: PointerEvent) => seek(moveEvent.clientX);
    const handleUp = () => {
      node.removeEventListener("pointermove", handleMove);
      node.removeEventListener("pointerup", handleUp);
    };
    node.addEventListener("pointermove", handleMove);
    node.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      ref={nodeRef}
      role="slider"
      tabIndex={0}
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuenow={playheadFrame}
      aria-valuemax={durationInFrames}
      className="relative h-7 w-full min-w-0 shrink-0 cursor-ew-resize bg-[#F7F7F8]"
      onPointerDown={handlePointerDown}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onSeek(Math.max(0, playheadFrame - (event.shiftKey ? FPS : 1)));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onSeek(playheadFrame + (event.shiftKey ? FPS : 1));
        }
      }}
    >
      {minors.map((frame) => (
        <span
          key={`m-${frame}`}
          className="absolute top-0 h-1.5 w-px bg-neutral-300"
          style={{ left: frame * zoom }}
        />
      ))}
      {marks.map((frame) => (
        <span key={frame} className="absolute top-0 flex flex-col items-start" style={{ left: frame * zoom }}>
          <span className="h-2 w-px bg-neutral-400" />
          <span className="pl-0.5 text-[10px] leading-none text-neutral-500">{frame / FPS}s</span>
        </span>
      ))}
    </div>
  );
}
