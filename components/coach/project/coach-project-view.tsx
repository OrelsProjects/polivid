"use client";

import type { UIMessage } from "ai";
import { motion } from "motion/react";
import { useState, type ReactNode, type RefObject, type UIEvent } from "react";
import { CoachThreadList, type CoachThreadItem } from "@/components/coach/coach-thread-list";
import { EditorProvider } from "@/components/editor/editor-provider";
import { TimelinePanel } from "@/components/editor/timeline/timeline";
import { useAutosave } from "@/components/editor/use-autosave";
import { useEditorShortcuts } from "@/components/editor/use-editor-shortcuts";
import { useMotionSafe } from "@/components/motion/motion";
import type { EditProjectView } from "@/lib/editor/types";
import type { VideoJobView } from "@/lib/video/job-status";
import { ProjectChatPanel } from "./project-chat-panel";
import { ProjectPendingBar, ProjectTopBar } from "./project-top-bar";
import { ProjectPlayer, ProjectRenderingStage } from "./project-stage";
import { useRemoteEdits } from "./use-remote-edits";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

function MobileSwitch({ value, onChange }: { value: "chat" | "timeline"; onChange: (value: "chat" | "timeline") => void }) {
  return (
    <div className="flex shrink-0 border-t border-border md:hidden" role="tablist" aria-label="Project panels">
      {(["chat", "timeline"] as const).map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={value === item}
          onClick={() => onChange(item)}
          className={`h-11 flex-1 text-sm capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${value === item ? "font-medium text-foreground" : "text-muted-foreground"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function ChatSheet({
  open,
  threads,
  activeId,
  onSelect,
  onCreate,
  onClose,
}: {
  open: boolean;
  threads: CoachThreadItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar shadow-xl">
      <CoachThreadList
        threads={threads}
        activeId={activeId}
        onSelect={(id) => {
          onClose();
          onSelect(id);
        }}
        onCreate={() => {
          onClose();
          onCreate();
        }}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 z-10 h-8 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Close
      </button>
    </div>
  );
}

function ReadyBody({
  messages,
  flushRef,
  log,
  composer,
  notice,
  scrollRef,
  onScroll,
  onChats,
  mobile,
  onMobile,
}: {
  messages: UIMessage[];
  flushRef: RefObject<(() => Promise<void>) | null>;
  log: ReactNode;
  composer: ReactNode;
  notice?: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  onChats: () => void;
  mobile: "chat" | "timeline";
  onMobile: (value: "chat" | "timeline") => void;
}) {
  useAutosave(flushRef);
  useEditorShortcuts();
  useRemoteEdits(messages);
  const safe = useMotionSafe();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ProjectTopBar onChats={onChats} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ProjectPlayer />
          <motion.div
            className={mobile === "timeline" ? "min-h-0 flex-1 md:flex-none" : "hidden md:block"}
            initial={safe ? { opacity: 0, y: 24 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={safe ? { ...spring, delay: 0.06 } : { duration: 0 }}
          >
            <TimelinePanel className="h-full md:h-64" />
          </motion.div>
        </div>
        <div className={mobile === "timeline" ? "hidden md:contents" : "flex min-h-0 flex-1 flex-col md:contents"}>
          <ProjectChatPanel log={log} composer={composer} notice={notice} canInspect scrollRef={scrollRef} onScroll={onScroll} />
        </div>
      </div>
      <MobileSwitch value={mobile} onChange={onMobile} />
    </div>
  );
}

export function CoachProjectView({
  project,
  job,
  title,
  messages,
  flushRef,
  threads,
  activeId,
  onSelectThread,
  onCreateThread,
  log,
  composer,
  notice,
  scrollRef,
  onScroll,
}: {
  project: EditProjectView | null;
  job: VideoJobView | null;
  title: string;
  messages: UIMessage[];
  flushRef: RefObject<(() => Promise<void>) | null>;
  threads: CoachThreadItem[];
  activeId?: string;
  onSelectThread: (id: string) => void;
  onCreateThread: () => void;
  log: ReactNode;
  composer: ReactNode;
  notice?: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
}) {
  const safe = useMotionSafe();
  const [chatsOpen, setChatsOpen] = useState(false);
  const [mobile, setMobile] = useState<"chat" | "timeline">("chat");
  const sheet = (
    <ChatSheet
      open={chatsOpen}
      threads={threads}
      activeId={activeId}
      onSelect={onSelectThread}
      onCreate={onCreateThread}
      onClose={() => setChatsOpen(false)}
    />
  );

  if (!project) {
    return (
        <div className="relative flex h-full min-h-0 flex-col bg-background">
          <ProjectPendingBar title={title} onChats={() => setChatsOpen(true)} />
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {job ? <ProjectRenderingStage job={job} /> : <div className="min-h-0 flex-1" />}
              <motion.div
                className={`border-t border-border p-3 ${mobile === "timeline" ? "min-h-40 flex-1 md:flex-none" : "hidden md:block"}`}
                initial={safe ? { opacity: 0, y: 24 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={safe ? spring : { duration: 0 }}
                aria-hidden
              >
                <div className="mb-2 h-8 rounded-md bg-primary/30" />
                <div className="mb-2 h-6 w-2/3 rounded-md bg-primary/20" />
                <div className="h-6 rounded-md bg-muted" />
              </motion.div>
            </div>
            <div className={mobile === "timeline" ? "hidden md:contents" : "flex min-h-0 flex-1 flex-col md:contents"}>
              <ProjectChatPanel
                log={log}
                composer={composer}
                notice={notice}
                canInspect={false}
                scrollRef={scrollRef}
                onScroll={onScroll}
              />
            </div>
          </div>
          <MobileSwitch value={mobile} onChange={setMobile} />
          {sheet}
        </div>
    );
  }

  return (
      <EditorProvider project={project}>
        <div className="relative h-full bg-background">
          <ReadyBody
            messages={messages}
            flushRef={flushRef}
            log={log}
            composer={composer}
            notice={notice}
            scrollRef={scrollRef}
            onScroll={onScroll}
            onChats={() => setChatsOpen(true)}
            mobile={mobile}
            onMobile={setMobile}
          />
          {sheet}
        </div>
      </EditorProvider>
  );
}
