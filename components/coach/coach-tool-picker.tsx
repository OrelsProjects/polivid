"use client";

import { ChevronDown, Wrench } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { VIDEO_MODES, videoModeById, type VideoMode } from "@/lib/video/modes";

/** Tools the brief can switch to. A tool that needs an uploaded file has nothing to film from a brief. */
const briefTools = (current: string) =>
  VIDEO_MODES.filter((mode) => mode.status === "live" && (mode.upload === "none" || mode.id === current));

function ToolMark({ mode }: { mode: VideoMode | null }) {
  const Icon = mode?.icon ?? Wrench;
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-foreground/80",
        mode?.tint ?? "from-muted to-muted",
      )}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}

/** The Create tool the Coach will film this brief with. The person can switch it before approving. */
export function CoachToolPicker({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (id: string) => void;
  editable: boolean;
}) {
  const selected = videoModeById(value);
  const title = selected?.title ?? (value === "production" ? "Production" : value);
  const summary = (
    <>
      <ToolMark mode={selected} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">Tool</span>
        <span className="block truncate font-medium">{title}</span>
      </span>
    </>
  );

  if (!editable || !selected) {
    return <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2">{summary}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tool, ${title}. Change the tool`}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 text-left outline-none hover:border-primary/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {summary}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[22rem] w-96 p-1.5">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {briefTools(value).map((mode) => (
            <DropdownMenuRadioItem
              key={mode.id}
              value={mode.id}
              closeOnClick
              className="items-start gap-2.5 rounded-lg px-2 py-1.5 pr-8"
            >
              <ToolMark mode={mode} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{mode.title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{mode.description}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
