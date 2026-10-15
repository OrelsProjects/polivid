import type { Shot, StepKind, StructureOutput } from "../schema";

export interface PlannedStep {
  kind: StepKind;
  targetKey: string;
  dependsOnKeys: string[];
}

const keyFor = (kind: StepKind, targetKey: string) => `${kind}:${targetKey}`;

export const plannedStepsAfterApprove = (structure: StructureOutput): PlannedStep[] => {
  const steps: PlannedStep[] = [];
  for (const character of structure.characters) {
    steps.push({ kind: "reference_image", targetKey: `character:${character.id}`, dependsOnKeys: [] });
  }
  for (const location of structure.locations) {
    steps.push({ kind: "reference_image", targetKey: `location:${location.id}`, dependsOnKeys: [] });
  }
  for (const shot of structure.shots) {
    steps.push({ kind: "reference_image", targetKey: `shot:${shot.id}`, dependsOnKeys: [] });
  }

  const speechKeys: string[] = [];
  for (const segment of structure.audioSegments) {
    if (segment.track === "dialogue" || segment.track === "narration") {
      const target = `speech:${segment.id}`;
      speechKeys.push(keyFor("speech", target));
      steps.push({ kind: "speech", targetKey: target, dependsOnKeys: [] });
    }
  }

  const shotReviewKeys = new Map<string, string>();
  const ordered = [...structure.shots].sort((a, b) => a.order - b.order);
  for (const shot of ordered) {
    const videoKey = `shot:${shot.id}`;
    // A shot with a predecessor waits for that review: it supplies the exact last frame and its description.
    const depends = [
      ...referenceKeysForShot(shot, structure),
      ...(shot.dependsOn && shot.continuity !== "new_scene" ? [keyFor("review_shot", `shot:${shot.dependsOn}`)] : []),
    ];
    steps.push({ kind: "shot_video", targetKey: videoKey, dependsOnKeys: depends });
    const reviewKey = keyFor("review_shot", videoKey);
    shotReviewKeys.set(shot.id, reviewKey);
    const afterVideo = [keyFor("shot_video", videoKey)];
    if (shot.speechMode === "lipsync") {
      const lipsyncTarget = `shot:${shot.id}`;
      steps.push({
        kind: "lipsync",
        targetKey: lipsyncTarget,
        dependsOnKeys: [...afterVideo, ...speechKeys],
      });
      afterVideo.push(keyFor("lipsync", lipsyncTarget));
    }
    steps.push({ kind: "review_shot", targetKey: videoKey, dependsOnKeys: afterVideo });
  }

  for (const segment of structure.audioSegments) {
    if (segment.track === "music") {
      steps.push({
        kind: "music",
        targetKey: `music:${segment.id}`,
        dependsOnKeys: [...shotReviewKeys.values()],
      });
    }
    if (segment.track === "ambience") {
      steps.push({
        kind: "ambience",
        targetKey: `ambience:${segment.id}`,
        dependsOnKeys: [...shotReviewKeys.values()],
      });
    }
    if (segment.track === "sfx") {
      steps.push({
        kind: "sfx",
        targetKey: `sfx:${segment.id}`,
        dependsOnKeys: [...shotReviewKeys.values()],
      });
    }
  }

  const assembleDeps = steps
    .filter((step) => ["review_shot", "music", "ambience", "sfx"].includes(step.kind))
    .map((step) => keyFor(step.kind, step.targetKey));
  steps.push({ kind: "assemble", targetKey: "timeline", dependsOnKeys: assembleDeps });
  steps.push({
    kind: "final_review",
    targetKey: "sequence",
    dependsOnKeys: [keyFor("assemble", "timeline")],
  });
  steps.push({
    kind: "export",
    targetKey: "export",
    dependsOnKeys: [keyFor("final_review", "sequence")],
  });
  return steps;
};

const referenceKeysForShot = (shot: Shot, structure: StructureOutput) => {
  const keys: string[] = [];
  for (const id of shot.characterIds) {
    if (structure.characters.some((character) => character.id === id)) {
      keys.push(keyFor("reference_image", `character:${id}`));
    }
  }
  const scene = structure.scenes.find((entry) => entry.id === shot.sceneId);
  if (scene) keys.push(keyFor("reference_image", `location:${scene.locationId}`));
  keys.push(keyFor("reference_image", `shot:${shot.id}`));
  return keys;
};

export const stepIdentity = (kind: StepKind, targetKey: string) => `${kind}:${targetKey}`;
