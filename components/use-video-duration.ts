"use client";

import { useEffect, useState } from "react";
import { isVideoKey, uploadFileUrl } from "@/lib/storage/upload-key";

/**
 * Seconds in an uploaded video, read from its metadata only. Null while loading,
 * for a key that is not a video, or when the browser can't read it.
 */
export const useVideoDuration = (mediaKey: string | null | undefined) => {
  const [reading, setReading] = useState<{ key: string; seconds: number | null } | null>(null);
  const key = mediaKey && isVideoKey(mediaKey) ? mediaKey : null;

  useEffect(() => {
    if (!key) return;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    let done = false;
    const finish = (seconds: number | null) => {
      if (done) return;
      done = true;
      setReading({ key, seconds });
    };
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = uploadFileUrl(key);
    return () => {
      done = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [key]);

  return key && reading?.key === key ? reading.seconds : null;
};
