"use client";

import { useEffect, useRef } from "react";
import { apiErrorStatus } from "@/lib/store/api-errors";
import { useSaveEditProjectMutation } from "@/lib/store/endpoints/editor";
import {
  useEditorActions,
  useEditorProjectId,
  useEditorSaveStatus,
  useEditorSnapshot,
  useEditorVersion,
} from "./editor-provider";

const DEBOUNCE_MS = 1000;

export const useAutosave = () => {
  const projectId = useEditorProjectId();
  const version = useEditorVersion();
  const saveStatus = useEditorSaveStatus();
  const snapshot = useEditorSnapshot();
  const { setSaveStatus, saved } = useEditorActions();
  const [saveProject] = useSaveEditProjectMutation();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (saveStatus !== "dirty") return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const run = async () => {
        setSaveStatus("saving");
        try {
          const project = await saveProject({
            id: projectId,
            title: snapshot.title,
            version,
            timeline: snapshot.timeline,
          }).unwrap();
          saved(project.version);
        } catch (error) {
          setSaveStatus(apiErrorStatus(error) === 409 ? "conflict" : "error");
        }
      };
      void run();
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [projectId, saveProject, saveStatus, saved, setSaveStatus, snapshot, version]);

  useEffect(() => {
    const handleUnload = () => {
      if (saveStatus !== "dirty") return;
      const body = JSON.stringify({
        title: snapshot.title,
        version,
        timeline: snapshot.timeline,
      });
      // RTK Query starts its fetch after a microtask, which can be too late during unload.
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
