import type { DevelopOutput, StructureOutput } from "./schema";

const SPOKEN_TRACKS = new Set(["dialogue", "narration"]);

export const voiceoverEnabled = (value: boolean | undefined) => value !== false;

/** Planner note: the story is acted, not spoken. */
export const VOICEOVER_OFF_NOTE =
  "Voiceover: off. Nobody speaks. No dialogue, narration, or voiceover. Leave every scene's dialogue empty and exactDialogue empty. Tell the story through what people do, where they look, and what changes. If the source has spoken lines, keep the events and show them as action, then drop the words. Do not ask who should speak. Estimate duration from action, pauses, and transitions only.";

/** Planner note: the sound plan has no speech tracks. */
export const VOICEOVER_OFF_STRUCTURE_NOTE =
  "Voiceover: off. Do not create dialogue or narration segments. Do not assign speaking voices. Set every shot speechMode to offscreen. Audio is music, ambience, and effects only. Nobody talks, on screen or off.";

export const withoutSpokenLines = (develop: DevelopOutput): DevelopOutput => ({
  ...develop,
  requirements: { ...develop.requirements, exactDialogue: [] },
  script: {
    ...develop.script,
    scenes: develop.script.scenes.map((scene) => ({ ...scene, dialogue: [] })),
  },
});

export const withoutSpeechTracks = (structure: StructureOutput): StructureOutput => {
  const spoken = new Set(
    structure.audioSegments.filter((segment) => SPOKEN_TRACKS.has(segment.track)).map((segment) => segment.id),
  );
  return {
    ...structure,
    voices: [],
    audioSegments: structure.audioSegments.filter((segment) => !spoken.has(segment.id)),
    shots: structure.shots.map((shot) => ({
      ...shot,
      speechMode: "offscreen" as const,
      audioSegmentIds: shot.audioSegmentIds.filter((id) => !spoken.has(id)),
    })),
  };
};
