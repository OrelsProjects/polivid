"use client";

import { Captions, Film, Music, SlidersHorizontal, Settings, Type, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setFormat } from "@/lib/editor/operations";
import type { LibraryVideo } from "@/lib/editor/types";
import { useRevertEditProjectMutation } from "@/lib/store/endpoints/editor";
import { cn } from "@/lib/utils";
import { VIDEO_FORMATS } from "@/lib/video/schema";
import { CaptionsPanel } from "./captions-panel";
import {
  useEditorActions,
  useEditorProjectId,
  useEditorSelection,
  useEditorSourceVideoId,
  useEditorTimeline,
} from "./editor-provider";
import { InspectorPanel } from "./inspector/inspector-panel";
import { AudioSection, MediaSection, TextSection } from "./media-panel";

export const EDITOR_SECTIONS = ["media", "text", "audio", "captions", "clip", "settings"] as const;
export type EditorSection = (typeof EDITOR_SECTIONS)[number];

const SECTION: Record<EditorSection, { label: string; title: string; icon: LucideIcon }> = {
  media: { label: "Media", title: "Media", icon: Film },
  text: { label: "Text", title: "Text", icon: Type },
  audio: { label: "Audio", title: "Audio", icon: Music },
  captions: { label: "Captions", title: "Captions", icon: Captions },
  clip: { label: "Clip", title: "Selected clip", icon: SlidersHorizontal },
  settings: { label: "Settings", title: "Settings", icon: Settings },
};

/** The column of sections down the left edge. Clicking the open section closes its panel. */
export function EditorRail({ open, onOpen }: { open: EditorSection | null; onOpen: (section: EditorSection | null) => void }) {
  const selection = useEditorSelection();
  return (
    <nav aria-label="Editor sections" className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3">
      {EDITOR_SECTIONS.map((id) => {
        const { label, icon: Icon } = SECTION[id];
        const active = open === id;
        const dimmed = id === "clip" && !selection;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onOpen(active ? null : id)}
            className={cn(
              "group flex w-[64px] cursor-pointer flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              dimmed && !active && "opacity-50",
            )}
          >
            <span
              className={cn(
                "grid size-9 place-items-center rounded-xl transition",
                active ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30" : "group-hover:bg-muted",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/** Canvas shape and going back to the video as it was made. */
function SettingsSection() {
  const timeline = useEditorTimeline();
  const actions = useEditorActions();
  const projectId = useEditorProjectId();
  const sourceVideoId = useEditorSourceVideoId();
  const [revertProject, { isLoading }] = useRevertEditProjectMutation();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Canvas</h3>
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              aria-pressed={timeline.format === format}
              onClick={() => actions.applyTimeline(setFormat(timeline, format))}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition",
                timeline.format === format ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              <span
                aria-hidden
                className="rounded-sm border-2 border-current"
                style={format === "9:16" ? { width: 14, height: 24 } : format === "16:9" ? { width: 28, height: 16 } : { width: 20, height: 20 }}
              />
              {format}
            </button>
          ))}
        </div>
      </section>
      {sourceVideoId ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Original</h3>
          <p className="text-xs text-muted-foreground">Throws away every change and starts again from the video this edit was made from.</p>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={async () => {
              const result = await revertProject(projectId);
              if (result.data) actions.replaceProject(result.data);
            }}
          >
            {isLoading ? "Reverting…" : "Revert to original"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

/** The open section's panel, beside the rail. */
export function EditorSidePanel({
  section,
  videos,
  onClose,
}: {
  section: EditorSection;
  videos: LibraryVideo[];
  onClose: () => void;
}) {
  return (
    <aside className="flex w-[min(34rem,40vw)] min-w-[22rem] shrink-0 flex-col border-r border-border bg-card">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-5">
        <h2 className="text-sm font-semibold">{SECTION[section].title}</h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close panel" onClick={onClose}>
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {section === "media" && <MediaSection videos={videos} />}
        {section === "text" && <TextSection />}
        {section === "audio" && <AudioSection />}
        {section === "captions" && <CaptionsPanel />}
        {section === "clip" && <InspectorPanel />}
        {section === "settings" && <SettingsSection />}
      </div>
    </aside>
  );
}
