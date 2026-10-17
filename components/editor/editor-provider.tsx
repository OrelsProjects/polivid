"use client";

import { bindActionCreators } from "@reduxjs/toolkit";
import { useCallback, useMemo, type ReactNode } from "react";
import type { EditProjectView } from "@/lib/editor/types";
import {
  editorActions,
  selectEditorDocument,
  selectEditorPlayback,
  selectHighlightIds,
  selectHoverFrame,
  type EditorDocument,
} from "@/lib/store/editor-slice";
import { useAppDispatch, useAppSelector, useAppStore } from "@/lib/store/hooks";

export {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  type EditorDocument,
  type EditorPlayback,
  type EditorSnapshot,
  type SaveStatus,
  type Selection,
} from "@/lib/store/editor-slice";

/**
 * Loads `project` into the editor slice before its children render, so they
 * never see an empty editor. Revisiting the same project in this store keeps
 * the in-session state, including undo history.
 */
export function EditorProvider({ project, children }: { project: EditProjectView; children: ReactNode }) {
  const store = useAppStore();
  if (selectEditorDocument(store.getState())?.projectId !== project.id) {
    store.dispatch(editorActions.loadProject(project));
  }
  return children;
}

const useEditorSelector = <T,>(select: (document: EditorDocument) => T) =>
  useAppSelector((state) => {
    const document = selectEditorDocument(state);
    if (!document) throw new Error("Editor hooks must be used inside EditorProvider.");
    return select(document);
  });

export const useEditorProjectId = () => useEditorSelector((document) => document.projectId);
export const useEditorSourceVideoId = () => useEditorSelector((document) => document.sourceVideoId);
export const useEditorVersion = () => useEditorSelector((document) => document.version);
export const useEditorExportVideoId = () => useEditorSelector((document) => document.exportVideoId);
export const useEditorExportVersion = () => useEditorSelector((document) => document.exportVersion);
export const useEditorSaveStatus = () => useEditorSelector((document) => document.saveStatus);
export const useEditorSelection = () => useEditorSelector((document) => document.selection);
export const useEditorZoom = () => useEditorSelector((document) => document.zoom);
export const useEditorSnapshot = () => useEditorSelector((document) => document.history.present);
export const useEditorTimeline = () => useEditorSelector((document) => document.history.present.timeline);
export const useEditorTitle = () => useEditorSelector((document) => document.history.present.title);
export const useEditorCanUndo = () => useEditorSelector((document) => document.history.past.length > 0);
export const useEditorCanRedo = () => useEditorSelector((document) => document.history.future.length > 0);

export const useEditorPlayback = () => useAppSelector(selectEditorPlayback);

/** Frame under the mouse on the timeline, or null when the mouse is elsewhere. */
export const useHoverFrame = () => useAppSelector(selectHoverFrame);

/** Clips the latest Coach edit changed. */
export const useEditorHighlights = () => useAppSelector(selectHighlightIds);

/** Reads playback at call time without re-rendering on every frame, for event handlers. */
export const useGetEditorPlayback = () => {
  const store = useAppStore();
  return useCallback(() => selectEditorPlayback(store.getState()), [store]);
};

export const useEditorActions = () => {
  const dispatch = useAppDispatch();
  return useMemo(() => bindActionCreators(editorActions, dispatch), [dispatch]);
};
