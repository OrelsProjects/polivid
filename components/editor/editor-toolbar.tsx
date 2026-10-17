"use client";

import { ArrowLeft, Redo2, Undo2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VIDEO_FORMATS } from "@/lib/video/schema";
import { setFormat } from "@/lib/editor/operations";
import { useRevertEditProjectMutation } from "@/lib/store/endpoints/editor";
import { cn } from "@/lib/utils";
import {
  useEditorActions,
  useEditorCanRedo,
  useEditorCanUndo,
  useEditorProjectId,
  useEditorSaveStatus,
  useEditorSourceVideoId,
  useEditorTimeline,
  useEditorTitle,
} from "./editor-provider";
import { ExportDialog } from "./export-dialog";

const SAVE_LABEL = {
  saved: "Saved",
  dirty: "Unsaved",
  saving: "Saving…",
  conflict: "Saved elsewhere",
  error: "Couldn’t save",
} as const;

export function EditorToolbar() {
  const projectId = useEditorProjectId();
  const sourceVideoId = useEditorSourceVideoId();
  const saveStatus = useEditorSaveStatus();
  const canUndo = useEditorCanUndo();
  const canRedo = useEditorCanRedo();
  const title = useEditorTitle();
  const timeline = useEditorTimeline();
  const actions = useEditorActions();
  const [revertProject] = useRevertEditProjectMutation();

  const handleRevert = async () => {
    if (!sourceVideoId) return;
    const result = await revertProject(projectId);
    if (result.data) actions.replaceProject(result.data);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
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
      <span className="hidden text-xs text-muted-foreground sm:inline">{SAVE_LABEL[saveStatus]}</span>
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
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" disabled={!canUndo} onClick={() => actions.undo()}>
        <Undo2 />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" disabled={!canRedo} onClick={() => actions.redo()}>
        <Redo2 />
      </Button>
      {sourceVideoId && (
        <Button type="button" variant="outline" size="sm" onClick={() => void handleRevert()}>
          Revert to original
        </Button>
      )}
      <ExportDialog />
      {saveStatus === "conflict" && (
        <p className={cn("text-xs text-destructive")} role="alert">
          This edit was saved in another tab. Reload to keep going.
        </p>
      )}
    </header>
  );
}
