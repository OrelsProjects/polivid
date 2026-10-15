"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { loadScrubMeta, scrubFrameUrl, scrubIndexForTime } from "@/lib/editor/scrub-preview";
import { useSquareTiles } from "./use-square-tiles";

export function ClipFilmstrip({
  videoId,
  startSeconds,
  durationSeconds,
  width,
}: {
  videoId: string;
  startSeconds: number;
  durationSeconds: number;
  width: number;
}) {
  const { ref, tile, count } = useSquareTiles(width);
  const [meta, setMeta] = useState<{ fps: number; count: number } | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    void loadScrubMeta(videoId).then((next) => {
      if (!cancelled && next) setMeta(next);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const tiles = useMemo(() => {
    return Array.from({ length: count }, (_, index) => {
      const time = startSeconds + ((index + 0.5) / count) * durationSeconds;
      const frame = meta ? scrubIndexForTime(time, meta.fps, meta.count) : 0;
      return { key: `${index}-${frame}`, src: meta ? scrubFrameUrl(videoId, frame) : null };
    });
  }, [count, durationSeconds, meta, startSeconds, videoId]);

  return (
    <div ref={ref} className="pointer-events-none flex h-full w-full overflow-hidden" aria-hidden>
      {tiles.map((entry) =>
        entry.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={entry.key}
            src={entry.src}
            alt=""
            draggable={false}
            className="h-full shrink-0 border-r border-black/30 object-cover"
            style={{ width: tile }}
          />
        ) : (
          <div key={entry.key} className="h-full shrink-0 border-r border-black/30 bg-neutral-800" style={{ width: tile }} />
        ),
      )}
    </div>
  );
}
