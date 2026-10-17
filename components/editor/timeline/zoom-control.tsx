"use client";

import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, useEditorActions, useEditorZoom } from "../editor-provider";

export function ZoomControl() {
  const zoom = useEditorZoom();
  const { setZoom } = useEditorActions();
  const percent = Math.round((zoom / DEFAULT_ZOOM) * 100);

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={1}
        value={zoom}
        aria-label="Timeline zoom"
        aria-valuemin={MIN_ZOOM}
        aria-valuemax={MAX_ZOOM}
        aria-valuenow={zoom}
        aria-valuetext={`${percent}%`}
        className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        onChange={(event) => setZoom(Number(event.target.value))}
      />
      <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{percent}%</span>
    </div>
  );
}
