"use client";

import { deleteItem, setCrossfade } from "@/lib/editor/operations";
import { findItem } from "@/lib/editor/schema";
import { Button } from "@/components/ui/button";
import { useEditorActions, useEditorSelection, useEditorTimeline } from "../editor-provider";
import { AudioInspector } from "./audio-inspector";
import { ImageInspector } from "./image-inspector";
import { TextInspector } from "./text-inspector";
import { TransitionPicker } from "./transition-picker";
import { VideoInspector } from "./video-inspector";

/** The settings of the clip selected on the timeline. Shown in the editor's side panel. */
export function InspectorPanel() {
  const timeline = useEditorTimeline();
  const selection = useEditorSelection();
  const actions = useEditorActions();
  const found = selection ? findItem(timeline, selection.itemId) : null;

  if (!found) {
    return <p className="text-sm text-muted-foreground">Select a clip on the timeline to edit it.</p>;
  }

  const { item, track } = found;
  const neighbors = track.items.filter((entry) => entry.id !== item.id);
  const neighbor = neighbors.find((entry) => entry.from >= item.from) ?? neighbors.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold capitalize">{item.kind}</h2>
        <p className="text-xs text-muted-foreground">{track.name}</p>
      </div>
      {item.kind === "video" && <VideoInspector item={item} timeline={timeline} />}
      {item.kind === "image" && <ImageInspector item={item} timeline={timeline} />}
      {item.kind === "text" && <TextInspector item={item} timeline={timeline} />}
      {item.kind === "audio" && <AudioInspector item={item} timeline={timeline} />}
      {item.kind === "scene" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{item.scene.headline}</p>
          <TransitionPicker item={item} timeline={timeline} edge="transitionIn" />
          <TransitionPicker item={item} timeline={timeline} edge="transitionOut" />
        </div>
      )}
      {neighbor && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => actions.applyTimeline(setCrossfade(timeline, item.id, neighbor.id, 12))}
        >
          Crossfade with neighbor
        </Button>
      )}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => {
          actions.applyTimeline(deleteItem(timeline, item.id));
          actions.select(null);
        }}
      >
        Delete clip
      </Button>
    </div>
  );
}
