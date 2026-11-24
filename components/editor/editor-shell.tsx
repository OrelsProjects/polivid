"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { EditProjectView, LibraryVideo } from "@/lib/editor/types";
import { EditorProvider, useEditorSelection } from "./editor-provider";
import { EditorRail, EditorSidePanel, type EditorSection } from "./editor-sections";
import { EditorToolbar } from "./editor-toolbar";
import { TimelinePanel } from "./timeline/timeline";
import { useAgentSync } from "./use-agent-sync";
import { useAutosave } from "./use-autosave";
import { useEditorShortcuts } from "./use-editor-shortcuts";

const PreviewPlayer = dynamic(() => import("./preview-player").then((module) => module.PreviewPlayer), {
  ssr: false,
});

function EditorWorkspace({ videos }: { videos: LibraryVideo[] }) {
  useAutosave();
  useEditorShortcuts();
  useAgentSync();
  const [section, setSection] = useState<EditorSection | null>("media");
  const selection = useEditorSelection();
  const selectedId = selection?.itemId ?? null;
  // Picking a clip on the timeline opens its settings, the way the inspector used to show them.
  const [seenSelection, setSeenSelection] = useState(selectedId);
  if (selectedId !== seenSelection) {
    setSeenSelection(selectedId);
    if (selectedId) setSection("clip");
  }
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <p role="note" className="shrink-0 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-800 lg:hidden">
        The editor works best on a wider screen. Rotate your device or switch to a laptop for the full timeline.
      </p>
      <EditorToolbar />
      <div className="flex min-h-0 flex-1">
        <EditorRail open={section} onOpen={setSection} />
        {section ? <EditorSidePanel section={section} videos={videos} onClose={() => setSection(null)} /> : null}
        <PreviewPlayer />
      </div>
      <TimelinePanel />
    </div>
  );
}

export function EditorShell({ project, videos }: { project: EditProjectView; videos: LibraryVideo[] }) {
  return (
    <EditorProvider project={project}>
      <EditorWorkspace videos={videos} />
    </EditorProvider>
  );
}
