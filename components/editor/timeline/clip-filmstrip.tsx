"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { loadScrubMeta, scrubFrameUrl, scrubIndexForTime } from "@/lib/editor/scrub-preview";

const TILE_WIDTH = 48;

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
    const count = Math.max(1, Math.ceil(width / TILE_WIDTH));
    return Array.from({ length: count }, (_, index) => {
      const time = startSeconds + ((index + 0.5) / count) * durationSeconds;
      const frame = meta ? scrubIndexForTime(time, meta.fps, meta.count) : 0;
      return { key: `${index}-${frame}`, src: meta ? scrubFrameUrl(videoId, frame) : null };
    });
  }, [durationSeconds, meta, startSeconds, videoId, width]);

  if (!meta) return <div className="h-full w-full bg-neutral-800" />;

  return (
    <div className="flex h-full w-full">
      {tiles.map((tile) =>
        tile.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            draggable={false}
            className="h-full shrink-0 object-cover"
            style={{ width: TILE_WIDTH }}
          />
        ) : (
          <div key={tile.key} className="h-full shrink-0 bg-neutral-800" style={{ width: TILE_WIDTH }} />
        ),
      )}
    </div>
  );
}
