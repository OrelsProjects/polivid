"use client";

import { useEffect } from "react";
import type { Timeline } from "@/lib/editor/schema";
import { selectEditorDocument } from "@/lib/store/editor-slice";
import { useAppStore } from "@/lib/store/hooks";
import { useEditorActions, useEditorProjectId } from "./editor-provider";

const POLL_MS = 5000;

/**
 * Agents connected over MCP save edits on the server, outside this page. While the tab is visible
 * and there is nothing unsaved here, pick up any newer version so the person sees the agent's work.
 * With unsaved changes the existing conflict flow handles it on the next save.
 */
export const useAgentSync = () => {
  const projectId = useEditorProjectId();
  const store = useAppStore();
  const { applyRemoteEdit } = useEditorActions();

  useEffect(() => {
    if (!projectId) return;
    let stopped = false;
    let busy = false;
    const check = async () => {
      if (busy || stopped || document.visibilityState !== "visible") return;
      const before = selectEditorDocument(store.getState());
      if (!before || before.projectId !== projectId || before.saveStatus !== "saved") return;
      busy = true;
      try {
        const response = await fetch(`/api/editor/projects/${projectId}`, { cache: "no-store" });
        if (!response.ok) return;
        const project = (await response.json()) as { timeline?: Timeline; version?: number; title?: string };
        const now = selectEditorDocument(store.getState());
        if (stopped || !now || now.projectId !== projectId || now.saveStatus !== "saved") return;
        if (!project.timeline || typeof project.version !== "number" || project.version <= now.version) return;
        applyRemoteEdit({ timeline: project.timeline, version: project.version, changedItemIds: [], title: project.title });
      } catch {
        // Offline or signed out: try again on the next tick.
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => void check(), POLL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [applyRemoteEdit, projectId, store]);
};
