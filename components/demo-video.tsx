"use client";

import { VideoPlayer } from "@/components/video/video-player";
import { DEMO_FACTS, DEMO_PLAN, DEMO_QUOTES } from "@/lib/video/demo";

/** The landing page's live example, rendered by the real composition with sample data. */
export function DemoVideo({ className }: { className?: string }) {
  return (
    <VideoPlayer
      plan={DEMO_PLAN}
      facts={DEMO_FACTS}
      quotes={DEMO_QUOTES}
      format="9:16"
      demo
      autoPlay
      controls={false}
      className={className}
    />
  );
}
