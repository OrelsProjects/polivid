"use client";

import { ArrowLeft, MessagesSquare, Redo2, Undo2 } from "lucide-react";
import Link from "next/link";
import { ExportDialog } from "@/components/editor/export-dialog";
import { useEditorActions, useEditorCanRedo, useEditorCanUndo, useEditorSaveStatus, useEditorTimeline, useEditorTitle } from "@/components/editor/editor-provider";
import { Button } from "@/components/ui/button";
import { setFormat } from "@/lib/editor/operations";
import { VIDEO_FORMATS } from "@/lib/video/schema";

const SAVE_LABEL = {
  saved: "Saved",
  dirty: "Unsaved",
  saving: "Saving…",
  conflict: "Saved elsewhere",
  error: "Couldn’t save",
} as const;

export function ProjectTopBar({ onChats }: { onChats: () => void }) {
  const title = useEditorTitle();
  const timeline = useEditorTimeline();
  const saveStatus = useEditorSaveStatus();
  const canUndo = useEditorCanUndo();
  const canRedo = useEditorCanRedo();
  const actions = useEditorActions();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <button
        type="button"
        onClick={onChats}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MessagesSquare aria-hidden className="size-4" />
        Chats
      </button>
      <span className="h-5 w-px bg-border" aria-hidden />
      <input
        value={title}
        aria-label="Project title"
        onChange={(event) => actions.setTitle(event.target.value)}
        className="h-8 min-w-0 max-w-64 flex-1 rounded-lg border border-transparent px-2 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span className="hidden text-xs text-muted-foreground sm:inline">{SAVE_LABEL[saveStatus]}</span>
      <div className="ml-auto flex items-center gap-1">
        {VIDEO_FORMATS.map((format) => (
          <Button
            key={format}
            type="button"
            size="xs"
            variant={timeline.format === format ? "default" : "outline"}
            aria-pressed={timeline.format === format}
            aria-label={`Canvas ${format}`}
            onClick={() => actions.applyTimeline(setFormat(timeline, format))}
          >
            {format}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" disabled={!canUndo} onClick={() => actions.undo()}>
          <Undo2 />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" disabled={!canRedo} onClick={() => actions.redo()}>
          <Redo2 />
        </Button>
        <ExportDialog />
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground/80 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Return
        </Link>
      </div>
    </header>
  );
}

export function ProjectPendingBar({ title, onChats }: { title: string; onChats: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <button
        type="button"
        onClick={onChats}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MessagesSquare aria-hidden className="size-4" />
        Chats
      </button>
      <span className="h-5 w-px bg-border" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
      <Link
        href="/dashboard"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground/80 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Return
      </Link>
    </header>
  );
}
