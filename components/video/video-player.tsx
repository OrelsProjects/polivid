"use client";

import dynamic from "next/dynamic";
import { VideoStage } from "@/components/video/video-stage";
import { cn } from "@/lib/utils";
import type { VideoFormat } from "@/lib/video/schema";
import type { RemotionVideoProps } from "./remotion-players";

const RemotionPlayer = dynamic(() => import("./remotion-players").then((m) => m.RemotionPlayer), {
  ssr: false,
});
const RemotionThumbnail = dynamic(() => import("./remotion-players").then((m) => m.RemotionThumbnail), {
  ssr: false,
});

const aspect: Record<VideoFormat, string> = {
  "9:16": "9 / 16",
  "16:9": "16 / 9",
  "1:1": "1 / 1",
};

/** Plays a filmed mp4 when one exists. Otherwise plays the Remotion composition. */
export function VideoPlayer({
  className,
  autoPlay = false,
  controls = true,
  footageUrl,
  ...video
}: RemotionVideoProps & { className?: string; autoPlay?: boolean; controls?: boolean; footageUrl?: string }) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/10", className)}
      style={{ aspectRatio: aspect[video.format] }}
    >
      {footageUrl ? (
        controls ? (
          <VideoStage src={footageUrl} autoPlay={autoPlay} className="size-full" title="Your video" />
        ) : (
          <video src={footageUrl} autoPlay={autoPlay} muted loop playsInline className="size-full bg-black object-cover" aria-hidden />
        )
      ) : (
        <RemotionPlayer {...video} autoPlay={autoPlay} controls={controls} />
      )}
    </div>
  );
};

export function VideoThumbnail({
  className,
  footageUrl,
  ...video
}: RemotionVideoProps & { className?: string; footageUrl?: string }) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg bg-black", className)}
      style={{ aspectRatio: aspect[video.format] }}
    >
      {footageUrl ? (
        <video src={footageUrl} muted playsInline preload="metadata" className="pointer-events-none size-full object-cover" />
      ) : (
        <RemotionThumbnail {...video} />
      )}
    </div>
  );
}
