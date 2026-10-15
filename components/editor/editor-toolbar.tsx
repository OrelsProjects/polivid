"use client";

import { ArrowLeft, Redo2, Undo2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VIDEO_FORMATS } from "@/lib/video/schema";
import { setFormat } from "@/lib/editor/operations";
import { cn } from "@/lib/utils";
import { useEditorActions, useEditorState, useEditorTimeline, useEditorTitle } from "./editor-provider";
import { ExportDialog } from "./export-dialog";

const SAVE_LABEL = {
  saved: "Saved",
  dirty: "Unsaved",
  saving: "Saving…",
  conflict: "Saved elsewhere",
  error: "Couldn’t save",
} as const;

export function EditorToolbar() {
  const state = useEditorState();
  const title = useEditorTitle();
  const timeline = useEditorTimeline();
  const actions = useEditorActions();
  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;

  const handleRevert = async () => {
    if (!state.sourceVideoId) return;
    const response = await fetch(`/api/editor/projects/${state.projectId}/revert`, { method: "POST" });
    if (!response.ok) return;
    const project = await response.json();
    actions.replaceProject(project);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-white px-3">
      <Link
        href="/editor"
        aria-label="Back to edits"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </Link>
      <span className="h-5 w-px bg-border" aria-hidden />
      <input
        value={title}
        aria-label="Edit title"
        onChange={(event) => actions.setTitle(event.target.value)}
        className="h-8 min-w-0 flex-1 rounded-lg border border-transparent px-2 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span className="hidden text-xs text-muted-foreground sm:inline">{SAVE_LABEL[state.saveStatus]}</span>
      <div className="flex items-center gap-1">
        {VIDEO_FORMATS.map((format) => (
          <Button
            key={format}
            type="button"
            size="xs"
            variant={timeline.format === format ? "default" : "ghost"}
            aria-pressed={timeline.format === format}
            aria-label={`Canvas ${format}`}
            onClick={() => actions.applyTimeline(setFormat(timeline, format))}
          >
            {format}
          </Button>
        ))}
      </div>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" disabled={!canUndo} onClick={actions.undo}>
        <Undo2 />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" disabled={!canRedo} onClick={actions.redo}>
        <Redo2 />
      </Button>
      {state.sourceVideoId && (
        <Button type="button" variant="outline" size="sm" onClick={() => void handleRevert()}>
          Revert to original
        </Button>
      )}
      <ExportDialog />
      {state.saveStatus === "conflict" && (
        <p className={cn("text-xs text-destructive")} role="alert">
          This edit was saved in another tab. Reload to keep going.
        </p>
      )}
    </header>
  );
}
