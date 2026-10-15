"use client";

import { useEffect, useRef } from "react";
import type { EditProjectView } from "@/lib/editor/types";
import { useEditorDispatch, useEditorState } from "./editor-provider";

const DEBOUNCE_MS = 1000;

export const useAutosave = () => {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const { projectId, version, saveStatus, history } = state;
  const snapshot = history.present;
  const timer = useRef<number | null>(null);
  const lastSaved = useRef(JSON.stringify(snapshot));

  useEffect(() => {
    if (saveStatus !== "dirty") return;
    const body = JSON.stringify({
      title: snapshot.title,
      version,
      timeline: snapshot.timeline,
    });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const run = async () => {
        dispatch({ type: "setSaveStatus", status: "saving" });
        const response = await fetch(`/api/editor/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (response.status === 409) {
          dispatch({ type: "setSaveStatus", status: "conflict" });
          return;
        }
        if (!response.ok) {
          dispatch({ type: "setSaveStatus", status: "error" });
          return;
        }
        const project = (await response.json()) as EditProjectView;
        lastSaved.current = JSON.stringify({ title: project.title, timeline: project.timeline });
        dispatch({ type: "saved", version: project.version });
      };
      void run();
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [dispatch, projectId, saveStatus, snapshot, version]);

  useEffect(() => {
    const handleUnload = () => {
      if (saveStatus !== "dirty") return;
      const body = JSON.stringify({
        title: snapshot.title,
        version,
        timeline: snapshot.timeline,
      });
      void fetch(`/api/editor/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [projectId, saveStatus, snapshot, version]);
};
