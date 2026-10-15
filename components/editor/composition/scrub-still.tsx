import { useLayoutEffect, useState } from "react";
import { loadScrubMeta, scrubFrameUrl, scrubIndexForTime } from "@/lib/editor/scrub-preview";

export function ScrubStill({
  videoId,
  time,
  fit,
}: {
  videoId: string;
  time: number;
  fit: "cover" | "contain";
}) {
  const [meta, setMeta] = useState<{ fps: number; count: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    void loadScrubMeta(videoId).then((next) => {
      if (!cancelled && next) setMeta(next);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const index = meta ? scrubIndexForTime(time, meta.fps, meta.count) : -1;
  const nextSrc = meta && index >= 0 ? scrubFrameUrl(videoId, index) : null;

  useLayoutEffect(() => {
    if (!nextSrc) return;
    const image = new Image();
    image.decoding = "async";
    image.src = nextSrc;
    const show = () => setSrc(nextSrc);
    if (image.complete) {
      show();
      return;
    }
    image.onload = show;
    return () => {
      image.onload = null;
    };
  }, [nextSrc]);

  if (!src) {
    return <div style={{ width: "100%", height: "100%", background: "#111" }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ width: "100%", height: "100%", objectFit: fit }}
    />
  );
}
