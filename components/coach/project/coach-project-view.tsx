"use client";

import type { UIMessage } from "ai";
import { motion } from "motion/react";
import { useRef, useState, type CSSProperties, type ReactNode, type RefObject, type UIEvent } from "react";
import { CoachThreadList, type CoachThreadItem } from "@/components/coach/coach-thread-list";
import { EditorProvider } from "@/components/editor/editor-provider";
import { TimelinePanel } from "@/components/editor/timeline/timeline";
import { useAutosave } from "@/components/editor/use-autosave";
import { useEditorShortcuts } from "@/components/editor/use-editor-shortcuts";
import { useMotionSafe } from "@/components/motion/motion";
import { cn } from "@/lib/utils";
import type { EditProjectView } from "@/lib/editor/types";
import type { VideoJobView } from "@/lib/video/job-status";
import type { GenerationModelId } from "@/lib/video/models";
import { PanelResizeHandle, SIDE_PANEL, TIMELINE_PANEL, useDynamicPanelSize, type PanelSize } from "./panel-resize";
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
  side,
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
  side: PanelSize;
}) {
  useAutosave(flushRef);
  useEditorShortcuts();
  useRemoteEdits(messages);
  const safe = useMotionSafe();
  const columnRef = useRef<HTMLDivElement>(null);
  const timeline = useDynamicPanelSize(TIMELINE_PANEL, columnRef, "y");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ProjectTopBar onChats={onChats} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div ref={columnRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ProjectPlayer />
          <div
            className={cn(
              "relative min-h-0",
              mobile === "timeline" ? "flex flex-1 flex-col" : "hidden",
              "md:flex md:h-[var(--timeline-height)] md:max-h-[calc(100%-15rem)] md:flex-none md:flex-col",
            )}
            style={{ "--timeline-height": `${timeline.size}px` } as CSSProperties}
          >
            <PanelResizeHandle
              axis="y"
              label="Resize timeline"
              panel={timeline}
              className="absolute inset-x-0 top-0 z-30 hidden h-3 -translate-y-1/2 md:block"
            />
            <motion.div
              className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
              initial={safe ? { opacity: 0, y: 24 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={safe ? { ...spring, delay: 0.06 } : { duration: 0 }}
            >
              <TimelinePanel className="h-full min-h-0 flex-1" />
            </motion.div>
          </div>
        </div>
        <div className={mobile === "timeline" ? "hidden md:contents" : "flex min-h-0 flex-1 flex-col md:contents"}>
          <ProjectChatPanel
            log={log}
            composer={composer}
            notice={notice}
            canInspect
            scrollRef={scrollRef}
            onScroll={onScroll}
            side={side}
          />
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
  models,
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
  models?: readonly GenerationModelId[];
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const side = useDynamicPanelSize(SIDE_PANEL, frameRef, "x");
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

  return (
    <div ref={frameRef} className="h-full min-h-0">
      {project ? (
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
              side={side}
            />
            {sheet}
          </div>
        </EditorProvider>
      ) : (
        <div className="relative flex h-full min-h-0 flex-col bg-background">
          <ProjectPendingBar title={title} onChats={() => setChatsOpen(true)} />
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {job ? <ProjectRenderingStage job={job} models={models} /> : <div className="min-h-0 flex-1" />}
            </div>
            <div className="flex min-h-0 flex-1 flex-col md:contents">
              <ProjectChatPanel
                log={log}
                composer={composer}
                notice={notice}
                canInspect={false}
                scrollRef={scrollRef}
                onScroll={onScroll}
                side={side}
              />
            </div>
          </div>
          {sheet}
        </div>
      )}
    </div>
  );
}
