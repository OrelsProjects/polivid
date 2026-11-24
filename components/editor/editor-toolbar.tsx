"use client";

import { ChevronDown, ChevronLeft, Cloud, CloudOff, Loader2, Monitor, Redo2, Smartphone, Square, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setFormat } from "@/lib/editor/operations";
import { cn } from "@/lib/utils";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";
import { LogoMark } from "@/components/logo";
import {
  useEditorActions,
  useEditorCanRedo,
  useEditorCanUndo,
  useEditorSaveStatus,
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

const FORMAT_ICON: Record<VideoFormat, LucideIcon> = { "9:16": Smartphone, "16:9": Monitor, "1:1": Square };
const FORMAT_NAME: Record<VideoFormat, string> = { "9:16": "Vertical", "16:9": "Landscape", "1:1": "Square" };

export function EditorToolbar() {
  const saveStatus = useEditorSaveStatus();
  const canUndo = useEditorCanUndo();
  const canRedo = useEditorCanRedo();
  const title = useEditorTitle();
  const timeline = useEditorTimeline();
  const actions = useEditorActions();
  const SaveIcon = saveStatus === "saving" ? Loader2 : saveStatus === "error" || saveStatus === "conflict" ? CloudOff : Cloud;
  const FormatIcon = FORMAT_ICON[timeline.format];

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
      <Link href="/dashboard" aria-label="Home" className="shrink-0">
        <LogoMark className="size-8" />
      </Link>
      <Link
        href="/editor"
        aria-label="Back to edits"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <input
        value={title}
        aria-label="Edit title"
        onChange={(event) => actions.setTitle(event.target.value)}
        className="h-9 w-[min(28rem,40vw)] min-w-0 truncate rounded-lg border border-transparent px-2 text-[15px] font-semibold outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span
        className={cn(
          "hidden items-center gap-1.5 text-xs sm:flex",
          saveStatus === "error" || saveStatus === "conflict" ? "text-destructive" : "text-muted-foreground",
        )}
        role={saveStatus === "conflict" ? "alert" : undefined}
        title={saveStatus === "conflict" ? "This edit was saved in another tab. Reload to keep going." : undefined}
      >
        <SaveIcon className={cn("size-4", saveStatus === "saving" && "animate-spin")} aria-hidden />
        {SAVE_LABEL[saveStatus]}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" disabled={!canUndo} onClick={() => actions.undo()}>
          <Undo2 />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" disabled={!canRedo} onClick={() => actions.redo()}>
          <Redo2 />
        </Button>
        <span className="mx-2 h-6 w-px bg-border" aria-hidden />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Canvas ${timeline.format}`}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <FormatIcon className="size-4" aria-hidden />
            {timeline.format}
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 p-1">
            <DropdownMenuRadioGroup
              value={timeline.format}
              onValueChange={(next) => {
                if ((VIDEO_FORMATS as readonly string[]).includes(next)) actions.applyTimeline(setFormat(timeline, next as VideoFormat));
              }}
            >
              {VIDEO_FORMATS.map((format) => {
                const Icon = FORMAT_ICON[format];
                return (
                  <DropdownMenuRadioItem key={format} value={format} className="gap-2">
                    <Icon className="size-4" aria-hidden />
                    {format}
                    <span className="ml-auto text-xs text-muted-foreground">{FORMAT_NAME[format]}</span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-1" />
        <ExportDialog />
      </div>
    </header>
  );
}
