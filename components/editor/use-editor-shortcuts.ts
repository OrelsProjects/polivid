"use client";

import { useEffect, useRef } from "react";
import { deleteItem, duplicateItem, nudgeItem, splitItem } from "@/lib/editor/operations";
import { findItem } from "@/lib/editor/schema";
import { useEditorActions, useEditorPlaybackRef, useEditorState } from "./editor-provider";

const typingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

export const useEditorShortcuts = () => {
  const state = useEditorState();
  const playbackRef = useEditorPlaybackRef();
  const actions = useEditorActions();
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;
      const current = stateRef.current;
      const timeline = current.history.present.timeline;
      const selected = current.selection ? findItem(timeline, current.selection.itemId) : null;
      const playback = playbackRef.current;

      if (event.code === "Space") {
        event.preventDefault();
        actions.setPlaying(!playback.isPlaying);
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        actions.setZoom(current.zoom + 1);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        actions.setZoom(current.zoom - 1);
        return;
      }
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "d" && selected) {
        event.preventDefault();
        actions.applyTimeline(duplicateItem(timeline, selected.item.id));
        return;
      }
      if (event.key.toLowerCase() === "s" && selected && !meta) {
        event.preventDefault();
        actions.applyTimeline(splitItem(timeline, selected.item.id, playback.playheadFrame));
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        actions.applyTimeline(deleteItem(timeline, selected.item.id));
        actions.select(null);
        return;
      }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && selected) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const frames = event.key === "ArrowLeft" ? -step : step;
        actions.applyTimeline(nudgeItem(timeline, selected.item.id, frames));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, playbackRef]);
};
