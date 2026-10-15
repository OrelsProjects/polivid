"use client";

import { patchItem } from "@/lib/editor/operations";
import type { AudioItem, Timeline } from "@/lib/editor/schema";
import { useEditorActions } from "../editor-provider";

export function AudioInspector({ item, timeline }: { item: AudioItem; timeline: Timeline }) {
  const actions = useEditorActions();
  const update = (patch: Partial<AudioItem>) => actions.applyTimeline(patchItem(timeline, item.id, patch));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        Volume
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={item.volume}
          aria-label="Volume"
          className="accent-primary"
          onChange={(event) => update({ volume: Number(event.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Fade in (frames)
        <input
          type="number"
          min={0}
          max={90}
          value={item.fadeIn}
          aria-label="Fade in"
          className="h-8 rounded-lg border border-input px-2"
          onChange={(event) => update({ fadeIn: Number(event.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Fade out (frames)
        <input
          type="number"
          min={0}
          max={90}
          value={item.fadeOut}
          aria-label="Fade out"
          className="h-8 rounded-lg border border-input px-2"
          onChange={(event) => update({ fadeOut: Number(event.target.value) })}
        />
      </label>
    </div>
  );
}
