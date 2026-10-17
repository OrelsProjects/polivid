"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { useEditorActions, useEditorHighlights } from "@/components/editor/editor-provider";
import { useMotionSafe } from "@/components/motion/motion";
import type { Timeline } from "@/lib/editor/schema";
import { selectEditorDocument } from "@/lib/store/editor-slice";
import { useAppStore } from "@/lib/store/hooks";

const isEditOutput = (part: UIMessage["parts"][number]) =>
  typeof part.type === "string" &&
  part.type.startsWith("tool-edit_") &&
  "state" in part &&
  part.state === "output-available" &&
  "toolCallId" in part;

/** Applies each Coach edit once, skipping saves the open project already has. */
export const useRemoteEdits = (messages: UIMessage[]) => {
  const store = useAppStore();
  const { applyRemoteEdit, clearHighlights } = useEditorActions();
  const highlights = useEditorHighlights();
  const safe = useMotionSafe();
  const applied = useRef(new Set<string>());

  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (!isEditOutput(part) || !("toolCallId" in part)) continue;
        if (applied.current.has(part.toolCallId)) continue;
        const output = "output" in part ? part.output : null;
        if (!output || typeof output !== "object") continue;
        const row = output as { project?: { timeline?: Timeline; version?: number }; changedItemIds?: unknown };
        if (!row.project?.timeline || typeof row.project.version !== "number") continue;
        const document = selectEditorDocument(store.getState());
        applied.current.add(part.toolCallId);
        if (!document || row.project.version <= document.version) continue;
        const changedItemIds = Array.isArray(row.changedItemIds)
          ? row.changedItemIds.filter((id): id is string => typeof id === "string")
          : [];
        applyRemoteEdit({ timeline: row.project.timeline, version: row.project.version, changedItemIds });
      }
    }
  }, [applyRemoteEdit, messages, store]);

  useEffect(() => {
    if (highlights.length === 0) return;
    const timer = window.setTimeout(() => clearHighlights(), safe ? 700 : 0);
    return () => window.clearTimeout(timer);
  }, [clearHighlights, highlights, safe]);
};
