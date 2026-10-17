import { createSlice, original, type Draft, type PayloadAction } from "@reduxjs/toolkit";
import type { Timeline } from "@/lib/editor/schema";
import type { EditProjectView } from "@/lib/editor/types";

const HISTORY_LIMIT = 100;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 24;
export const DEFAULT_ZOOM = 4;

export type SaveStatus = "saved" | "dirty" | "saving" | "conflict" | "error";
export type Selection = { trackId: string; itemId: string } | null;

export interface EditorSnapshot {
  timeline: Timeline;
  title: string;
}

export interface EditorDocument {
  projectId: string;
  sourceVideoId: string | null;
  version: number;
  /** Finished MP4 for exportVersion, when that render still exists. */
  exportVideoId: string | null;
  exportVersion: number | null;
  history: { past: EditorSnapshot[]; present: EditorSnapshot; future: EditorSnapshot[] };
  gestureBase: EditorSnapshot | null;
  selection: Selection;
  zoom: number;
  saveStatus: SaveStatus;
}

export interface EditorPlayback {
  playheadFrame: number;
  isPlaying: boolean;
}

export interface EditorState {
  /** The open edit project, or null before the editor page loads one. */
  document: EditorDocument | null;
  playback: EditorPlayback;
  /** Frame under the mouse on the timeline, or null when the mouse is elsewhere. */
  hoverFrame: number | null;
  /** Clips a Coach edit just changed. The timeline pulses them, then clears the list. */
  highlightIds: string[];
}

export type ProjectSource = Pick<
  EditProjectView,
  "timeline" | "title" | "version" | "sourceVideoId" | "exportVideoId" | "exportVersion"
>;

type EditorDraft = Draft<EditorState>;

const initialState: EditorState = {
  document: null,
  playback: { playheadFrame: 0, isPlaying: false },
  hoverFrame: null,
  highlightIds: [],
};

const sameSnapshot = (a: EditorSnapshot, b: EditorSnapshot) => a.title === b.title && a.timeline === b.timeline;

/**
 * The document as it was before this action. Snapshot checks compare object
 * identity, which only works on real state objects, never on Immer drafts.
 */
const baseDocument = (state: EditorDraft) => (state.document ? (original(state.document) ?? null) : null);

const pushHistory = (state: EditorDraft, next: (present: EditorSnapshot) => EditorSnapshot) => {
  const base = baseDocument(state);
  if (!base || !state.document) return;
  const snapshot = next(base.history.present);
  if (sameSnapshot(base.history.present, snapshot)) return;
  state.document.history = {
    past: [...base.history.past, base.history.present].slice(-HISTORY_LIMIT),
    present: snapshot,
    future: [],
  };
  state.document.saveStatus = "dirty";
};

export const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    loadProject: (state, action: PayloadAction<EditProjectView>) => {
      const project = action.payload;
      state.document = {
        projectId: project.id,
        sourceVideoId: project.sourceVideoId,
        version: project.version,
        exportVideoId: project.exportVideoId,
        exportVersion: project.exportVersion,
        history: { past: [], present: { timeline: project.timeline, title: project.title }, future: [] },
        gestureBase: null,
        selection: null,
        zoom: DEFAULT_ZOOM,
        saveStatus: "saved",
      };
      state.playback = { playheadFrame: 0, isPlaying: false };
      state.hoverFrame = null;
    },
    applySnapshot: (state, action: PayloadAction<EditorSnapshot>) => {
      pushHistory(state, () => action.payload);
    },
    applyTimeline: (state, action: PayloadAction<Timeline>) => {
      pushHistory(state, (present) => ({ timeline: action.payload, title: present.title }));
    },
    setTitle: (state, action: PayloadAction<string>) => {
      pushHistory(state, (present) => ({ ...present, title: action.payload }));
    },
    beginGesture: (state) => {
      const base = baseDocument(state);
      if (!base || !state.document) return;
      state.document.gestureBase = base.history.present;
    },
    updateTimeline: (state, action: PayloadAction<Timeline>) => {
      const base = baseDocument(state);
      if (!base || !state.document) return;
      state.document.history.present = { timeline: action.payload, title: base.history.present.title };
      state.document.saveStatus = "dirty";
    },
    endGesture: (state) => {
      const base = baseDocument(state);
      if (!base || !state.document) return;
      state.document.gestureBase = null;
      if (!base.gestureBase || sameSnapshot(base.gestureBase, base.history.present)) return;
      state.document.history = {
        past: [...base.history.past, base.gestureBase].slice(-HISTORY_LIMIT),
        present: base.history.present,
        future: [],
      };
      state.document.saveStatus = "dirty";
    },
    undo: (state) => {
      const base = baseDocument(state);
      const previous = base?.history.past.at(-1);
      if (!base || !previous || !state.document) return;
      state.document.history = {
        past: base.history.past.slice(0, -1),
        present: previous,
        future: [base.history.present, ...base.history.future],
      };
      state.document.saveStatus = "dirty";
    },
    redo: (state) => {
      const base = baseDocument(state);
      const next = base?.history.future[0];
      if (!base || !next || !state.document) return;
      state.document.history = {
        past: [...base.history.past, base.history.present],
        present: next,
        future: base.history.future.slice(1),
      };
      state.document.saveStatus = "dirty";
    },
    select: (state, action: PayloadAction<Selection>) => {
      if (state.document) state.document.selection = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      if (state.document) state.document.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, action.payload));
    },
    setSaveStatus: (state, action: PayloadAction<SaveStatus>) => {
      if (state.document) state.document.saveStatus = action.payload;
    },
    saved: (state, action: PayloadAction<number>) => {
      if (!state.document) return;
      state.document.version = action.payload;
      state.document.saveStatus = "saved";
    },
    markExported: (state, action: PayloadAction<{ videoId: string; version: number }>) => {
      if (!state.document) return;
      state.document.exportVideoId = action.payload.videoId;
      state.document.exportVersion = action.payload.version;
    },
    replaceProject: (state, action: PayloadAction<ProjectSource>) => {
      if (!state.document) return;
      const project = action.payload;
      state.document.sourceVideoId = project.sourceVideoId;
      state.document.version = project.version;
      state.document.exportVideoId = project.exportVideoId;
      state.document.exportVersion = project.exportVersion;
      state.document.history = {
        past: [],
        present: { timeline: project.timeline, title: project.title },
        future: [],
      };
      state.document.gestureBase = null;
      state.document.selection = null;
      state.document.saveStatus = "saved";
    },
    setPlayhead: (state, action: PayloadAction<number>) => {
      state.playback.playheadFrame = Math.max(0, action.payload);
    },
    setPlaying: (state, action: PayloadAction<boolean>) => {
      state.playback.isPlaying = action.payload;
    },
    setHoverFrame: (state, action: PayloadAction<number | null>) => {
      state.hoverFrame = action.payload;
    },
    /** A save that already happened on the server. Undo can still step back to the previous cut. */
    applyRemoteEdit: (
      state,
      action: PayloadAction<{ timeline: Timeline; version: number; changedItemIds: string[] }>,
    ) => {
      const base = baseDocument(state);
      if (!base || !state.document) return;
      const snapshot = { timeline: action.payload.timeline, title: base.history.present.title };
      if (!sameSnapshot(base.history.present, snapshot)) {
        state.document.history = {
          past: [...base.history.past, base.history.present].slice(-HISTORY_LIMIT),
          present: snapshot,
          future: [],
        };
      }
      state.document.version = action.payload.version;
      state.document.saveStatus = "saved";
      state.highlightIds = action.payload.changedItemIds;
      const firstId = action.payload.changedItemIds[0];
      if (!firstId) return;
      for (const track of action.payload.timeline.tracks) {
        const item = track.items.find((entry) => entry.id === firstId);
        if (!item) continue;
        state.playback.playheadFrame = item.from;
        state.playback.isPlaying = false;
        state.document.selection = { trackId: track.id, itemId: item.id };
        return;
      }
    },
    clearHighlights: (state) => {
      state.highlightIds = [];
    },
  },
  selectors: {
    selectEditorDocument: (state) => state.document,
    selectEditorPlayback: (state) => state.playback,
    selectHoverFrame: (state) => state.hoverFrame,
    selectHighlightIds: (state) => state.highlightIds,
  },
});

export const editorActions = editorSlice.actions;
export const { selectEditorDocument, selectEditorPlayback, selectHoverFrame, selectHighlightIds } = editorSlice.selectors;
