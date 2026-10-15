"use client";

import { Textarea } from "@/components/ui/textarea";
import { patchItem } from "@/lib/editor/operations";
import type { TextItem, Timeline } from "@/lib/editor/schema";
import { useEditorActions } from "../editor-provider";
import { TransitionPicker } from "./transition-picker";

export function TextInspector({ item, timeline }: { item: TextItem; timeline: Timeline }) {
  const actions = useEditorActions();
  const update = (patch: Partial<TextItem>) => actions.applyTimeline(patchItem(timeline, item.id, patch));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        Text
        <Textarea
          value={item.text}
          aria-label="On-screen text"
          onChange={(event) => update({ text: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Size
        <input
          type="range"
          min={16}
          max={200}
          value={item.style.fontSize}
          aria-label="Font size"
          className="accent-primary"
          onChange={(event) => update({ style: { ...item.style, fontSize: Number(event.target.value) } })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Color
        <input
          type="color"
          value={item.style.color}
          aria-label="Text color"
          onChange={(event) => update({ style: { ...item.style, color: event.target.value } })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Background
        <input
          type="color"
          value={item.style.background ?? "#000000"}
          aria-label="Text background"
          onChange={(event) => update({ style: { ...item.style, background: event.target.value } })}
        />
      </label>
      <TransitionPicker item={item} timeline={timeline} edge="transitionIn" />
      <TransitionPicker item={item} timeline={timeline} edge="transitionOut" />
    </div>
  );
}
