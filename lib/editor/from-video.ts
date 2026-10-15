import { FPS, type VideoRecord } from "@/lib/video/schema";
import { defaultTransform, emptyTimeline, newId, type Timeline, type VideoItem } from "./schema";

type SourceVideo = Pick<VideoRecord, "id" | "title" | "format" | "length" | "plan" | "facts" | "quotes">;

export const timelineFromVideo = (video: SourceVideo, options: { hasFootage?: boolean } = {}): Timeline => {
  const timeline = emptyTimeline(video.format);
  if (options.hasFootage) {
    const durationInFrames = Math.max(1, Math.round(video.length * FPS));
    const assetId = newId();
    const item: VideoItem = {
      kind: "video",
      id: newId(),
      from: 0,
      durationInFrames,
      transitionIn: null,
      transitionOut: null,
      assetId,
      trimStart: 0,
      volume: 1,
      transform: defaultTransform(),
      opacity: 1,
    };
    return {
      ...timeline,
      assets: [
        {
          id: assetId,
          kind: "video",
          source: { type: "video", videoId: video.id },
          name: video.title,
          durationInFrames,
          width: null,
          height: null,
        },
      ],
      tracks: timeline.tracks.map((track, index) => (index === 0 ? { ...track, items: [item] } : track)),
    };
  }

  const scenes = video.plan?.scenes ?? [];
  if (scenes.length === 0) return timeline;

  let from = 0;
  const items = scenes.map((scene) => {
    const durationInFrames = Math.max(1, Math.round(scene.durationSec * FPS));
    const item = {
      kind: "scene" as const,
      id: newId(),
      from,
      durationInFrames,
      transitionIn: null,
      transitionOut: null,
      scene,
      facts: video.facts,
      quotes: video.quotes,
      trimStart: 0,
    };
    from += durationInFrames;
    return item;
  });

  return {
    ...timeline,
    tracks: timeline.tracks.map((track, index) => (index === 0 ? { ...track, items } : track)),
  };
};
