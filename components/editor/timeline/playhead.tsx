"use client";

import { useHoverFrame } from "../editor-provider";

export const TRACK_HEADER_WIDTH = 48;

export function HoverLine({ zoom }: { zoom: number }) {
  const hoverFrame = useHoverFrame();
  if (hoverFrame === null) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 bottom-0 z-[25] w-px -translate-x-1/2 bg-neutral-400/80"
      style={{ left: TRACK_HEADER_WIDTH + hoverFrame * zoom }}
    />
  );
}

export function Playhead({ frame, zoom }: { frame: number; zoom: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 bottom-0 z-30"
      style={{ left: TRACK_HEADER_WIDTH + frame * zoom }}
    >
      <div className="absolute top-1.5 left-0 size-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_2px_#fff]" />
      <div className="absolute top-3.5 bottom-0 left-0 w-0.5 -translate-x-1/2 bg-primary" />
    </div>
  );
}
