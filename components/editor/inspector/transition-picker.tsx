"use client";

import { Button } from "@/components/ui/button";
import { patchItem } from "@/lib/editor/operations";
import { TRANSITION_TYPES, type Timeline, type TimelineItem, type Transition } from "@/lib/editor/schema";
import { useEditorActions } from "../editor-provider";

export function TransitionPicker({
  item,
  timeline,
  edge,
}: {
  item: TimelineItem;
  timeline: Timeline;
  edge: "transitionIn" | "transitionOut";
}) {
  const actions = useEditorActions();
  const current = item[edge];

  const handlePick = (type: Transition["type"] | "none") => {
    const next: Transition | null = type === "none" ? null : { type, durationInFrames: current?.durationInFrames ?? 12 };
    actions.applyTimeline(patchItem(timeline, item.id, { [edge]: next }));
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{edge === "transitionIn" ? "In" : "Out"}</span>
      <div className="flex flex-wrap gap-1">
        {(["none", ...TRANSITION_TYPES] as const).map((type) => (
          <Button
            key={type}
            type="button"
            size="xs"
            variant={(current?.type ?? "none") === type ? "default" : "ghost"}
            aria-pressed={(current?.type ?? "none") === type}
            onClick={() => handlePick(type)}
          >
            {type}
          </Button>
        ))}
      </div>
    </div>
  );
}
