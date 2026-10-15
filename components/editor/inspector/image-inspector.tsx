"use client";

import { patchItem } from "@/lib/editor/operations";
import type { ImageItem, Timeline } from "@/lib/editor/schema";
import { useEditorActions } from "../editor-provider";
import { FillFrameButton } from "./fill-frame-button";
import { TransitionPicker } from "./transition-picker";

export function ImageInspector({ item, timeline }: { item: ImageItem; timeline: Timeline }) {
  const actions = useEditorActions();
  const update = (patch: Partial<ImageItem>) => actions.applyTimeline(patchItem(timeline, item.id, patch));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        Opacity
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={item.opacity}
          aria-label="Opacity"
          className="accent-primary"
          onChange={(event) => update({ opacity: Number(event.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Scale
        <input
          type="range"
          min={0.05}
          max={4}
          step={0.01}
          value={item.transform.scale}
          aria-label="Scale"
          className="accent-primary"
          onChange={(event) => update({ transform: { ...item.transform, scale: Number(event.target.value) } })}
        />
      </label>
      <FillFrameButton transform={item.transform} onChange={(transform) => update({ transform })} />
      <TransitionPicker item={item} timeline={timeline} edge="transitionIn" />
      <TransitionPicker item={item} timeline={timeline} edge="transitionOut" />
    </div>
  );
}
