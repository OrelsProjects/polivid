"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { EditProjectView } from "@/lib/editor/types";
import type { Timeline } from "@/lib/editor/schema";

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

export type EditorState = EditorDocument & EditorPlayback;

export type EditorAction =
  | { type: "apply"; snapshot: EditorSnapshot }
  | { type: "beginGesture" }
  | { type: "updateGesture"; snapshot: EditorSnapshot }
  | { type: "endGesture" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; selection: Selection }
  | { type: "setPlayhead"; frame: number }
  | { type: "setZoom"; zoom: number }
  | { type: "setPlaying"; playing: boolean }
  | { type: "setTitle"; title: string }
  | { type: "setSaveStatus"; status: SaveStatus }
  | { type: "saved"; version: number }
  | { type: "replace"; project: Pick<EditProjectView, "timeline" | "title" | "version" | "sourceVideoId"> };

const sameSnapshot = (a: EditorSnapshot, b: EditorSnapshot) =>
  a.title === b.title && a.timeline === b.timeline;

const pushHistory = (state: EditorState, next: EditorSnapshot): EditorState => {
  if (sameSnapshot(state.history.present, next)) return state;
  return {
    ...state,
    history: {
      past: [...state.history.past, state.history.present].slice(-HISTORY_LIMIT),
      present: next,
      future: [],
    },
    saveStatus: "dirty",
  };
};

const reducer = (state: EditorState, action: EditorAction): EditorState => {
  if (action.type === "apply") return pushHistory(state, action.snapshot);
  if (action.type === "beginGesture") {
    return { ...state, gestureBase: state.history.present };
  }
  if (action.type === "updateGesture") {
    return { ...state, history: { ...state.history, present: action.snapshot }, saveStatus: "dirty" };
  }
  if (action.type === "endGesture") {
    if (!state.gestureBase || sameSnapshot(state.gestureBase, state.history.present)) {
      return { ...state, gestureBase: null };
    }
    return {
      ...state,
      gestureBase: null,
      history: {
        past: [...state.history.past, state.gestureBase].slice(-HISTORY_LIMIT),
        present: state.history.present,
        future: [],
      },
      saveStatus: "dirty",
    };
  }
  if (action.type === "undo") {
    const previous = state.history.past.at(-1);
    if (!previous) return state;
    return {
      ...state,
      history: {
        past: state.history.past.slice(0, -1),
        present: previous,
        future: [state.history.present, ...state.history.future],
      },
      saveStatus: "dirty",
    };
  }
  if (action.type === "redo") {
    const next = state.history.future[0];
    if (!next) return state;
    return {
      ...state,
      history: {
        past: [...state.history.past, state.history.present],
        present: next,
        future: state.history.future.slice(1),
      },
      saveStatus: "dirty",
    };
  }
  if (action.type === "select") return { ...state, selection: action.selection };
  if (action.type === "setPlayhead") {
    const playheadFrame = Math.max(0, action.frame);
    if (playheadFrame === state.playheadFrame) return state;
    return { ...state, playheadFrame };
  }
  if (action.type === "setZoom") {
    return { ...state, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, action.zoom)) };
  }
  if (action.type === "setPlaying") {
    if (action.playing === state.isPlaying) return state;
    return { ...state, isPlaying: action.playing };
  }
  if (action.type === "setTitle") {
    return pushHistory(state, { ...state.history.present, title: action.title });
  }
  if (action.type === "setSaveStatus") return { ...state, saveStatus: action.status };
  if (action.type === "saved") return { ...state, version: action.version, saveStatus: "saved" };
  if (action.type === "replace") {
    return {
      ...state,
      sourceVideoId: action.project.sourceVideoId,
      version: action.project.version,
      history: {
        past: [],
        present: { timeline: action.project.timeline, title: action.project.title },
        future: [],
      },
      gestureBase: null,
      selection: null,
      saveStatus: "saved",
    };
  }
  return state;
};

const EditorStateContext = createContext<EditorDocument | null>(null);
const PlaybackContext = createContext<EditorPlayback | null>(null);
const PlaybackRefContext = createContext<MutableRefObject<EditorPlayback> | null>(null);
const EditorDispatchContext = createContext<Dispatch<EditorAction> | null>(null);
const HoverFrameContext = createContext<number | null>(null);
const SetHoverFrameContext = createContext<((frame: number | null) => void) | null>(null);

export function EditorProvider({
  project,
  children,
}: {
  project: EditProjectView;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, project, (initial): EditorState => ({
    projectId: initial.id,
    sourceVideoId: initial.sourceVideoId,
    version: initial.version,
    history: { past: [], present: { timeline: initial.timeline, title: initial.title }, future: [] },
    gestureBase: null,
    selection: null,
    playheadFrame: 0,
    zoom: DEFAULT_ZOOM,
    isPlaying: false,
    saveStatus: "saved",
  }));

  const [hoverFrame, setHoverFrame] = useState<number | null>(null);
  const playbackRef = useRef<EditorPlayback>({ playheadFrame: 0, isPlaying: false });
  useEffect(() => {
    playbackRef.current = { playheadFrame: state.playheadFrame, isPlaying: state.isPlaying };
  }, [state.isPlaying, state.playheadFrame]);

  const documentState = useMemo<EditorDocument>(
    () => ({
      projectId: state.projectId,
      sourceVideoId: state.sourceVideoId,
      version: state.version,
      history: state.history,
      gestureBase: state.gestureBase,
      selection: state.selection,
      zoom: state.zoom,
      saveStatus: state.saveStatus,
    }),
    [
      state.gestureBase,
      state.history,
      state.projectId,
      state.saveStatus,
      state.selection,
      state.sourceVideoId,
      state.version,
      state.zoom,
    ],
  );
  const playback = useMemo<EditorPlayback>(
    () => ({ playheadFrame: state.playheadFrame, isPlaying: state.isPlaying }),
    [state.isPlaying, state.playheadFrame],
  );

  return (
    <EditorStateContext.Provider value={documentState}>
      <PlaybackContext.Provider value={playback}>
        <PlaybackRefContext.Provider value={playbackRef}>
          <EditorDispatchContext.Provider value={dispatch}>
            <SetHoverFrameContext.Provider value={setHoverFrame}>
              <HoverFrameContext.Provider value={hoverFrame}>{children}</HoverFrameContext.Provider>
            </SetHoverFrameContext.Provider>
          </EditorDispatchContext.Provider>
        </PlaybackRefContext.Provider>
      </PlaybackContext.Provider>
    </EditorStateContext.Provider>
  );
}

export const useEditorState = () => {
  const state = useContext(EditorStateContext);
  if (!state) throw new Error("useEditorState must be used inside EditorProvider.");
  return state;
};

export const useEditorPlayback = () => {
  const playback = useContext(PlaybackContext);
  if (!playback) throw new Error("useEditorPlayback must be used inside EditorProvider.");
  return playback;
};

export const useEditorPlaybackRef = () => {
  const ref = useContext(PlaybackRefContext);
  if (!ref) throw new Error("useEditorPlaybackRef must be used inside EditorProvider.");
  return ref;
};

export const useEditorDispatch = () => {
  const dispatch = useContext(EditorDispatchContext);
  if (!dispatch) throw new Error("useEditorDispatch must be used inside EditorProvider.");
  return dispatch;
};

/** Frame under the mouse on the timeline, or null when the mouse is elsewhere. */
export const useHoverFrame = () => useContext(HoverFrameContext);

export const useSetHoverFrame = () => {
  const setHoverFrame = useContext(SetHoverFrameContext);
  if (!setHoverFrame) throw new Error("useSetHoverFrame must be used inside EditorProvider.");
  return setHoverFrame;
};

export const useEditorTimeline = () => useEditorState().history.present.timeline;
export const useEditorTitle = () => useEditorState().history.present.title;

export const useEditorActions = () => {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  return useMemo(
    () => ({
      applyTimeline: (timeline: Timeline) =>
        dispatch({ type: "apply", snapshot: { timeline, title: state.history.present.title } }),
      applySnapshot: (snapshot: EditorSnapshot) => dispatch({ type: "apply", snapshot }),
      beginGesture: () => dispatch({ type: "beginGesture" }),
      updateTimeline: (timeline: Timeline) =>
        dispatch({ type: "updateGesture", snapshot: { timeline, title: state.history.present.title } }),
      endGesture: () => dispatch({ type: "endGesture" }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      select: (selection: Selection) => dispatch({ type: "select", selection }),
      setPlayhead: (frame: number) => dispatch({ type: "setPlayhead", frame }),
      setZoom: (zoom: number) => dispatch({ type: "setZoom", zoom }),
      setPlaying: (playing: boolean) => dispatch({ type: "setPlaying", playing }),
      setTitle: (title: string) => dispatch({ type: "setTitle", title }),
      replaceProject: (project: Pick<EditProjectView, "timeline" | "title" | "version" | "sourceVideoId">) =>
        dispatch({ type: "replace", project }),
    }),
    [dispatch, state.history.present.title],
  );
};
