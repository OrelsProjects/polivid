"use client";

import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";

type PanelBounds = {
  key: string;
  min: number;
  max: number;
  fallback: number;
  /** Share of the measured container when the user has not chosen a size. */
  ratio: number;
  /** Pixels kept for the neighboring pane (preview or player). */
  reserve: number;
};

/** Chat column. Wider than the old 400px lock, and it tracks the window until dragged. */
export const SIDE_PANEL: PanelBounds = {
  key: "polivid.layout.side",
  min: 400,
  max: 840,
  fallback: 560,
  ratio: 0.42,
  reserve: 360,
};

/** Timeline under the player. Taller than the old 256px lock, and it tracks the window until dragged. */
export const TIMELINE_PANEL: PanelBounds = {
  key: "polivid.layout.timeline",
  min: 200,
  max: 560,
  fallback: 360,
  ratio: 0.5,
  reserve: 240,
};

export type PanelSize = {
  size: number;
  min: number;
  limit: number;
  setSize: (value: number) => void;
  reset: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

const readPreferred = (key: string, min: number, max: number) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return clamp(value, min, max);
  } catch {
    return null;
  }
};

const writePreferred = (key: string, value: number | null) => {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
  } catch {
    /* private mode */
  }
};

export function useDynamicPanelSize(
  bounds: PanelBounds,
  containerRef: RefObject<HTMLElement | null>,
  axis: "x" | "y",
): PanelSize {
  const [preferred, setPreferred] = useState<number | null>(null);
  const [span, setSpan] = useState(0);
  const boundsRef = useRef(bounds);
  const spanRef = useRef(0);
  boundsRef.current = bounds;
  spanRef.current = span;

  useLayoutEffect(() => {
    setPreferred(readPreferred(bounds.key, bounds.min, bounds.max));
  }, [bounds.key, bounds.min, bounds.max]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const next = axis === "x" ? node.clientWidth : node.clientHeight;
      setSpan((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [axis, containerRef]);

  const limit =
    span > 0 ? Math.min(bounds.max, Math.max(bounds.min, span - bounds.reserve)) : bounds.max;
  const basis = preferred ?? (span > 0 ? Math.round(span * bounds.ratio) : bounds.fallback);
  const size = clamp(basis, bounds.min, limit);

  const setSize = useCallback((next: number) => {
    const current = boundsRef.current;
    const currentSpan = spanRef.current;
    const currentLimit =
      currentSpan > 0
        ? Math.min(current.max, Math.max(current.min, currentSpan - current.reserve))
        : current.max;
    const value = clamp(next, current.min, currentLimit);
    setPreferred(value);
    writePreferred(current.key, value);
  }, []);

  const reset = useCallback(() => {
    setPreferred(null);
    writePreferred(boundsRef.current.key, null);
  }, []);

  return { size, min: bounds.min, limit, setSize, reset };
}

export function PanelResizeHandle({
  axis,
  label,
  panel,
  className,
}: {
  axis: "x" | "y";
  label: string;
  panel: PanelSize;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startPoint = axis === "x" ? event.clientX : event.clientY;
    const startValue = panelRef.current.size;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    setDragging(true);

    const onMove = (moveEvent: PointerEvent) => {
      const point = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
      panelRef.current.setSize(startValue - (point - startPoint));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      setDragging(false);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = panelRef.current;
    const step = event.shiftKey ? 48 : 24;
    const grow = axis === "x" ? "ArrowLeft" : "ArrowUp";
    const shrink = axis === "x" ? "ArrowRight" : "ArrowDown";
    if (event.key === grow) {
      event.preventDefault();
      current.setSize(current.size + step);
    } else if (event.key === shrink) {
      event.preventDefault();
      current.setSize(current.size - step);
    } else if (event.key === "Home") {
      event.preventDefault();
      current.setSize(current.min);
    } else if (event.key === "End") {
      event.preventDefault();
      current.setSize(current.limit);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuemin={panel.min}
      aria-valuemax={panel.limit}
      aria-valuenow={panel.size}
      aria-valuetext={`${panel.size} pixels`}
      tabIndex={0}
      title="Drag to resize. Double-click to fit the window."
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        event.preventDefault();
        panel.reset();
      }}
      onKeyDown={onKeyDown}
      className={cn(
        "group touch-none outline-none focus-visible:outline-none",
        axis === "x" ? "cursor-col-resize" : "cursor-row-resize",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute bg-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
          dragging && "opacity-100",
          axis === "x" ? "inset-y-0 left-1/2 w-0.5 -translate-x-1/2" : "inset-x-0 top-1/2 h-0.5 -translate-y-1/2",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute rounded-full bg-muted-foreground/55 transition-colors group-hover:bg-primary group-focus-visible:bg-primary",
          dragging && "bg-primary",
          axis === "x"
            ? "top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2"
            : "top-1/2 left-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2",
        )}
      />
    </div>
  );
}
