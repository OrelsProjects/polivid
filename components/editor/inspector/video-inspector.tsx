"use client";

import { coverFrame } from "@/lib/editor/framing";
import { patchItem } from "@/lib/editor/operations";
import type { Timeline, VideoItem } from "@/lib/editor/schema";
import { useEditorActions } from "../editor-provider";
import { TransitionPicker } from "./transition-picker";

const NumberField = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) => (
  <label className="flex flex-col gap-1 text-xs">
    {label}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      className="accent-primary"
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <span className="text-muted-foreground">{value.toFixed(2)}</span>
  </label>
);

export function VideoInspector({ item, timeline }: { item: VideoItem; timeline: Timeline }) {
  const actions = useEditorActions();
  const update = (patch: Partial<VideoItem>) => actions.applyTimeline(patchItem(timeline, item.id, patch));
  const transform = coverFrame(item.transform);

  return (
    <div className="flex flex-col gap-3">
      <NumberField label="Volume" value={item.volume} min={0} max={2} onChange={(volume) => update({ volume })} />
      <NumberField label="Opacity" value={item.opacity} min={0} max={1} onChange={(opacity) => update({ opacity })} />
      <NumberField
        label="Scale"
        value={transform.scale}
        min={1}
        max={4}
        onChange={(scale) => update({ transform: coverFrame({ ...transform, scale }) })}
      />
      <NumberField
        label="Rotation"
        value={transform.rotation}
        min={-180}
        max={180}
        step={1}
        onChange={(rotation) => update({ transform: { ...transform, rotation } })}
      />
      <TransitionPicker item={item} timeline={timeline} edge="transitionIn" />
      <TransitionPicker item={item} timeline={timeline} edge="transitionOut" />
    </div>
  );
}
