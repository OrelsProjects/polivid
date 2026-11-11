"use client";

import { useState, type CSSProperties, type ReactNode, type RefObject, type UIEvent } from "react";
import { InspectorPanel } from "@/components/editor/inspector/inspector-panel";
import { cn } from "@/lib/utils";
import { PanelResizeHandle, type PanelSize } from "./panel-resize";

export function ProjectChatPanel({
  log,
  composer,
  notice,
  canInspect,
  scrollRef,
  onScroll,
  side,
}: {
  log: ReactNode;
  composer: ReactNode;
  notice?: ReactNode;
  canInspect: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  side: PanelSize;
}) {
  const [tab, setTab] = useState<"chat" | "inspect">("chat");

  return (
    <aside
      className="relative flex h-full min-h-0 w-full flex-col border-border bg-sidebar md:w-[var(--side-width)] md:max-w-[calc(100%-22.5rem)] md:shrink-0 md:border-l"
      style={{ "--side-width": `${side.size}px` } as CSSProperties}
    >
      <PanelResizeHandle
        axis="x"
        label="Resize chat"
        panel={side}
        className="absolute inset-y-0 -left-1.5 z-30 hidden w-3 md:block"
      />
      <div className="flex h-12 shrink-0 items-end gap-4 border-b border-border px-4" role="tablist" aria-label="Project side">
        {(["chat", "inspect"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={cn(
              "h-10 border-b-2 px-1 text-sm capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === item ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {item === "chat" ? "Chat" : "Inspect"}
          </button>
        ))}
      </div>
      {tab === "inspect" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {canInspect ? (
            <InspectorPanel />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">The timeline appears when the video is ready.</p>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {log}
          </div>
          {notice}
          {composer}
        </>
      )}
    </aside>
  );
}
