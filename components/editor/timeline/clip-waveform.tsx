"use client";

import { useLayoutEffect, useState } from "react";
import { loadWaveform, slicePeaks } from "@/lib/editor/waveform-preview";

export function ClipWaveform({
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
  const [bars, setBars] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    void loadWaveform(videoId).then((meta) => {
      if (cancelled || !meta?.hasAudio) {
        if (!cancelled) setBars([]);
        return;
      }
      const count = Math.max(8, Math.floor(width / 2));
      setBars(slicePeaks(meta, startSeconds, durationSeconds, count));
    });
    return () => {
      cancelled = true;
    };
  }, [durationSeconds, startSeconds, videoId, width]);

  if (bars === null) return null;
  if (bars.length === 0) {
    return <span className="px-2 text-[10px] font-medium text-white/70">No audio</span>;
  }

  return (
    <div className="flex h-full w-full items-center gap-px px-1" aria-hidden>
      {bars.map((peak, index) => (
        <span
          key={index}
          className="min-h-px flex-1 rounded-full bg-white/80"
          style={{ height: `${Math.max(8, peak * 100)}%` }}
        />
      ))}
    </div>
  );
}
