import { assetById, type Timeline, type TimelineItem, type Track, type VideoItem } from "@/lib/editor/schema";

/** Video clips whose sound lives in the picture file, not on an audio item. */
export const footageSoundClips = (timeline: Timeline): VideoItem[] => {
  const clips: VideoItem[] = [];
  for (const track of timeline.tracks) {
    for (const item of track.items) {
      if (item.kind !== "video") continue;
      if (assetById(timeline, item.assetId)?.source.type === "video") clips.push(item);
    }
  }
  return clips;
};

export const isVoiceItem = (timeline: Timeline, item: TimelineItem) => {
  if (item.kind !== "audio") return false;
  const asset = assetById(timeline, item.assetId);
  if (!asset) return false;
  return asset.source.type === "voice" || asset.name.startsWith("Voiceover");
};

/** Voiceover (or any other audio clip) is on an audio track, so footage sound needs its own lane. */
export const footageSoundSeparate = (timeline: Timeline) =>
  footageSoundClips(timeline).length > 0 &&
  timeline.tracks.some((track) => track.kind === "audio" && track.items.length > 0);

export const footageSoundTracks = (timeline: Timeline): Track[] => {
  const ids = new Set(footageSoundClips(timeline).map((item) => item.id));
  return timeline.tracks.filter(
    (track) => track.kind === "visual" && track.items.some((item) => ids.has(item.id)),
  );
};
