import { FPS, dimensionsFor, type VideoFormat } from "@/lib/video/schema";
import {
  defaultTransform,
  emptyTimeline,
  newId,
  type AudioItem,
  type Timeline,
  type VideoItem,
} from "@/lib/editor/schema";
import type { ProductionTimeline, TimelineClip } from "../schema";

export const timelineDurationSec = (clips: TimelineClip[]) =>
  clips.reduce((end, clip) => Math.max(end, clip.startSec + clip.durationSec), 0);

export const validateProductionTimeline = (timeline: ProductionTimeline) => {
  const issues: string[] = [];
  const computed = timelineDurationSec(timeline.clips);
  if (Math.abs(computed - timeline.durationSec) > 0.05) {
    issues.push(`Stored duration ${timeline.durationSec}s does not match computed ${computed.toFixed(2)}s.`);
  }
  return { ok: issues.length === 0, issues, durationSec: computed };
};

export const compileToEditorTimeline = (
  production: ProductionTimeline,
  format: VideoFormat,
  assets: { id: string; kind: "video" | "audio" | "image"; name: string }[],
): Timeline => {
  const timeline = emptyTimeline(format);
  const assetIds = new Map(assets.map((asset) => [asset.id, newId()]));
  const mappedAssets = assets.map((asset) => ({
    id: assetIds.get(asset.id)!,
    kind: asset.kind,
    source: { type: "production" as const, assetId: asset.id },
    name: asset.name,
    durationInFrames: null,
    width: production.width,
    height: production.height,
  }));

  const videoItems: VideoItem[] = [];
  const audioItems: AudioItem[] = [];
  for (const clip of production.clips) {
    const mapped = assetIds.get(clip.assetId);
    if (!mapped) continue;
    const from = Math.round(clip.startSec * FPS);
    const durationInFrames = Math.max(1, Math.round(clip.durationSec * FPS));
    const trimStart = Math.round(clip.trimInSec * FPS);
    if (clip.kind === "audio") {
      audioItems.push({
        kind: "audio",
        id: clip.id,
        from,
        durationInFrames,
        transitionIn: null,
        transitionOut: null,
        assetId: mapped,
        trimStart,
        volume: clip.volume,
        fadeIn: Math.round(clip.fadeInSec * FPS),
        fadeOut: Math.round(clip.fadeOutSec * FPS),
      });
    } else if (clip.kind === "video") {
      videoItems.push({
        kind: "video",
        id: clip.id,
        from,
        durationInFrames,
        transitionIn:
          clip.transition === "dissolve"
            ? { type: "fade", durationInFrames: Math.max(1, Math.round(0.25 * FPS)) }
            : null,
        transitionOut: null,
        assetId: mapped,
        trimStart,
        volume: clip.volume,
        transform: defaultTransform(),
        opacity: 1,
      });
    }
  }

  return {
    ...timeline,
    assets: mappedAssets,
    tracks: timeline.tracks.map((track, index) => {
      if (index === 0) return { ...track, items: videoItems };
      if (track.kind === "audio") return { ...track, items: audioItems };
      return track;
    }),
  };
};

export const projectDimensions = (format: VideoFormat) => dimensionsFor(format);
