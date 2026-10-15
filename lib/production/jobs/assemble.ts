import type { StructureOutput, TimelineClip } from "../schema";

export interface StepAsset {
  id: string;
  kind: string;
  stepKind: string | null;
  targetKey: string | null;
}

/**
 * Pairs each asset with the step that produced it. Older video assets were
 * saved under the provider's job id instead of ours, so both are accepted.
 */
export const assetsByStep = (
  assets: { id: string; kind: string; producedByJobId: string | null }[],
  jobs: { id: string; stepId: string; providerJobId: string | null }[],
  steps: { id: string; kind: string; targetKey: string }[],
): StepAsset[] => {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  return assets.map((asset) => {
    const job = jobs.find(
      (entry) => entry.id === asset.producedByJobId || (entry.providerJobId !== null && entry.providerJobId === asset.producedByJobId),
    );
    const step = job ? stepById.get(job.stepId) : undefined;
    return { id: asset.id, kind: asset.kind, stepKind: step?.kind ?? null, targetKey: step?.targetKey ?? null };
  });
};

/** The footage that represents a shot right now: lipsynced if it exists, otherwise the latest take. */
export const videoForShot = (shotId: string, assets: StepAsset[]) => {
  const target = `shot:${shotId}`;
  const videos = assets.filter((asset) => asset.kind === "video" && asset.targetKey === target);
  // Lipsynced footage replaces the raw shot; otherwise the latest take wins.
  return videos.findLast((asset) => asset.stepKind === "lipsync") ?? videos.findLast((asset) => asset.stepKind === "shot_video") ?? null;
};

const audioForSegment = (segmentId: string, assets: StepAsset[]) =>
  assets.findLast((asset) => asset.kind === "audio" && asset.targetKey?.split(":")[1] === segmentId) ?? null;

/** Builds the production timeline: one clip per filmed shot and one per generated audio segment. */
export const assembleClips = (structure: StructureOutput | null, assets: StepAsset[]): TimelineClip[] => {
  const shots = [...(structure?.shots ?? [])].sort((a, b) => a.order - b.order);
  const clips: TimelineClip[] = [];
  let cursor = 0;
  for (const shot of shots) {
    const video = videoForShot(shot.id, assets);
    if (video) {
      clips.push({
        id: `clip_${shot.id}`,
        shotId: shot.id,
        assetId: video.id,
        kind: "video",
        startSec: cursor,
        durationSec: shot.editDurationSec,
        trimInSec: 0,
        trimOutSec: shot.editDurationSec,
        volume: 0,
        fadeInSec: 0,
        fadeOutSec: 0,
        transition: "cut",
      });
    }
    cursor += shot.editDurationSec;
  }
  for (const segment of structure?.audioSegments ?? []) {
    const audio = audioForSegment(segment.id, assets);
    if (!audio) continue;
    const firstShot = shots.find((shot) => shot.id === segment.shotIds[0]);
    const start = shots
      .filter((shot) => shot.order < (firstShot?.order ?? 0))
      .reduce((sum, shot) => sum + shot.editDurationSec, 0);
    clips.push({
      id: `clip_${segment.id}`,
      shotId: firstShot?.id ?? null,
      assetId: audio.id,
      kind: "audio",
      startSec: start + segment.startOffsetSec,
      durationSec: segment.measuredDurationSec ?? segment.durationSec,
      trimInSec: 0,
      trimOutSec: segment.durationSec,
      volume: segment.track === "music" ? 0.35 : 1,
      fadeInSec: segment.fadeInSec,
      fadeOutSec: segment.fadeOutSec,
      transition: null,
    });
  }
  return clips;
};
