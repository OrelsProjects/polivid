"use client";

import { useEffect, useState } from "react";

/** Captures run a few at a time, so a grid of clips never takes every connection the browser allows. */
const LANES = 2;
const STILL_WIDTH = 360;
let running = 0;
const waiting: (() => void)[] = [];

const takeLane = () =>
  new Promise<void>((resolve) => {
    if (running < LANES) {
      running += 1;
      resolve();
      return;
    }
    waiting.push(resolve);
  });

const freeLane = () => {
  const next = waiting.shift();
  if (next) next();
  else running = Math.max(0, running - 1);
};

/** Loads just enough of a clip to draw one frame, then lets the connection go. */
const captureStill = (src: string, isCancelled: () => boolean) =>
  new Promise<string>((resolve, reject) => {
    const video = document.createElement("video");
    const release = () => {
      video.removeAttribute("src");
      video.load();
    };
    const fail = () => {
      release();
      reject(new Error("no still"));
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = fail;
    video.onloadedmetadata = () => {
      if (isCancelled()) return fail();
      // A moment in, past a fade from black, but never past the middle of a short clip.
      const at = Number.isFinite(video.duration) ? Math.min(1, video.duration / 2) : 0;
      if (at > 0) video.currentTime = at;
    };
    const draw = () => {
      if (isCancelled() || !video.videoWidth) return fail();
      try {
        const scale = Math.min(1, STILL_WIDTH / video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", 0.72);
        release();
        resolve(url);
      } catch {
        fail();
      }
    };
    video.onseeked = draw;
    video.onloadeddata = () => {
      // A clip too short to seek into is drawn from its first frame.
      if (!Number.isFinite(video.duration) || video.duration / 2 <= 0) draw();
    };
    video.src = src;
  });

/**
 * A still picture of a clip, for grids and lists. A `<video>` in every tile can hold a
 * connection open each, and a browser allows only a few to one site, so the rest of
 * the page stalls. This draws one frame and then closes the clip.
 */
export function VideoStill({ src, className }: { src: string; className?: string }) {
  const [still, setStill] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void takeLane()
      .then(() => (cancelled ? Promise.reject(new Error("left")) : captureStill(src, () => cancelled)))
      .then(
        (url) => {
          if (!cancelled) setStill(url);
        },
        () => {
          if (!cancelled) setFailed(true);
        },
      )
      .finally(freeLane);
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    // The clip could not be drawn here, so show it the plain way.
    return <video src={src} muted playsInline preload="metadata" className={className} />;
  }
  if (!still) return <div aria-hidden className={className} style={{ background: "#111" }} />;
  // eslint-disable-next-line @next/next/no-img-element -- a frame drawn in this browser
  return <img src={still} alt="" draggable={false} className={className} />;
}
