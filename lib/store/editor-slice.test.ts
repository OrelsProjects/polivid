import assert from "node:assert/strict";
import test from "node:test";
import { addTrack } from "@/lib/editor/operations";
import { emptyTimeline } from "@/lib/editor/schema";
import type { EditProjectView } from "@/lib/editor/types";
import { editorActions, editorSlice, MAX_ZOOM, MIN_ZOOM, type EditorState } from "./editor-slice";
import { makeStore } from "./store";

const project: EditProjectView = {
  id: "project-a",
  title: "Draft",
  format: "9:16",
  timeline: emptyTimeline(),
  version: 3,
  sourceVideoId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const reduce = (state: EditorState | undefined, ...actions: Parameters<typeof editorSlice.reducer>[1][]) =>
  actions.reduce<EditorState>((current, action) => editorSlice.reducer(current, action), state ?? editorSlice.getInitialState());

const loaded = () => reduce(undefined, editorActions.loadProject(project));

const documentOf = (state: EditorState) => {
  assert.ok(state.document);
  return state.document;
};

test("applyTimeline pushes history, and undo and redo walk it", () => {
  const next = addTrack(project.timeline, "text");
  const applied = reduce(loaded(), editorActions.applyTimeline(next));
  assert.equal(documentOf(applied).history.present.timeline, next);
  assert.equal(documentOf(applied).history.present.title, "Draft");
  assert.equal(documentOf(applied).history.past.length, 1);
  assert.equal(documentOf(applied).saveStatus, "dirty");

  const undone = reduce(applied, editorActions.undo());
  assert.equal(documentOf(undone).history.present.timeline, project.timeline);
  assert.equal(documentOf(undone).history.future.length, 1);

  const redone = reduce(undone, editorActions.redo());
  assert.equal(documentOf(redone).history.present.timeline, next);
  assert.equal(documentOf(redone).history.future.length, 0);
});

test("applying the current timeline again changes nothing", () => {
  const state = loaded();
  assert.equal(reduce(state, editorActions.applyTimeline(project.timeline)), state);
});

test("a drag gesture becomes one undo step", () => {
  const first = addTrack(project.timeline, "text");
  const second = addTrack(first, "audio");
  const dragged = reduce(
    loaded(),
    editorActions.beginGesture(),
    editorActions.updateTimeline(first),
    editorActions.updateTimeline(second),
    editorActions.endGesture(),
  );
  assert.equal(documentOf(dragged).history.present.timeline, second);
  assert.equal(documentOf(dragged).history.past.length, 1);
  assert.equal(documentOf(dragged).gestureBase, null);

  const undone = reduce(dragged, editorActions.undo());
  assert.equal(documentOf(undone).history.present.timeline, project.timeline);
});

test("a gesture that ends where it started adds no history", () => {
  const state = reduce(loaded(), editorActions.beginGesture(), editorActions.endGesture());
  assert.equal(documentOf(state).history.past.length, 0);
  assert.equal(documentOf(state).saveStatus, "saved");
});

test("history keeps the last 100 steps", () => {
  let state = loaded();
  let timeline = project.timeline;
  for (let step = 0; step < 105; step += 1) {
    timeline = addTrack(timeline, "text");
    state = reduce(state, editorActions.applyTimeline(timeline));
  }
  assert.equal(documentOf(state).history.past.length, 100);
});

test("setTitle keeps the timeline and is undoable", () => {
  const state = reduce(loaded(), editorActions.setTitle("Final cut"));
  assert.equal(documentOf(state).history.present.title, "Final cut");
  assert.equal(documentOf(state).history.present.timeline, project.timeline);
  assert.equal(documentOf(reduce(state, editorActions.undo())).history.present.title, "Draft");
});

test("setZoom clamps to the allowed range", () => {
  assert.equal(documentOf(reduce(loaded(), editorActions.setZoom(999))).zoom, MAX_ZOOM);
  assert.equal(documentOf(reduce(loaded(), editorActions.setZoom(-5))).zoom, MIN_ZOOM);
});

test("replaceProject resets history and selection", () => {
  const reverted = emptyTimeline("16:9");
  const state = reduce(
    loaded(),
    editorActions.applyTimeline(addTrack(project.timeline, "text")),
    editorActions.select({ trackId: "track", itemId: "item" }),
    editorActions.replaceProject({ timeline: reverted, title: "Original", version: 9, sourceVideoId: "video-a" }),
  );
  const document = documentOf(state);
  assert.equal(document.history.present.timeline, reverted);
  assert.equal(document.history.past.length, 0);
  assert.equal(document.selection, null);
  assert.equal(document.version, 9);
  assert.equal(document.saveStatus, "saved");
});

test("document actions before a project loads are ignored", () => {
  const empty = editorSlice.getInitialState();
  const state = reduce(empty, editorActions.applyTimeline(project.timeline), editorActions.undo(), editorActions.setZoom(8));
  assert.equal(state.document, null);
});

test("playhead never goes below frame zero", () => {
  assert.equal(reduce(loaded(), editorActions.setPlayhead(-20)).playback.playheadFrame, 0);
});

test("the store mounts the api and editor slices", () => {
  const store = makeStore();
  store.dispatch(editorActions.loadProject(project));
  const state = store.getState();
  assert.equal(state.editor.document?.projectId, "project-a");
  assert.ok(state.api);
});
