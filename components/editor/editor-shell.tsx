"use client";

import dynamic from "next/dynamic";
import type { EditProjectView, LibraryVideo } from "@/lib/editor/types";
import { EditorProvider } from "./editor-provider";
import { EditorToolbar } from "./editor-toolbar";
import { InspectorPanel } from "./inspector/inspector-panel";
import { MediaPanel } from "./media-panel";
import { TimelinePanel } from "./timeline/timeline";
import { useAutosave } from "./use-autosave";
import { useEditorShortcuts } from "./use-editor-shortcuts";

const PreviewPlayer = dynamic(() => import("./preview-player").then((module) => module.PreviewPlayer), {
  ssr: false,
});

function EditorWorkspace({ videos }: { videos: LibraryVideo[] }) {
  useAutosave();
  useEditorShortcuts();
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <p role="note" className="shrink-0 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-200 lg:hidden">
        The editor works best on a wider screen. Rotate your device or switch to a laptop for the full timeline.
      </p>
      <EditorToolbar />
      <div className="flex min-h-0 flex-1">
        <MediaPanel videos={videos} />
        <PreviewPlayer />
        <InspectorPanel />
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
