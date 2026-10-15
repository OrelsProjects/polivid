import type { z } from "zod";
import type { DevelopOutput, StructureOutput } from "../schema";
import { plannerModelFor, plannerProvider } from "./config";
import type { Planner, PlannerRequest, PlannerResult } from "./types";

export interface MockPlannerHandlers {
  develop?: (input: string) => DevelopOutput;
  structure?: (input: string) => StructureOutput;
}

const defaultDevelop = (input: string): DevelopOutput => {
  const request = input.split("User request:").at(-1) ?? input;
  const detailed = /INT\.|EXT\.|FADE IN|dialogue:|^[A-Z][A-Z ]+:/m.test(request) || request.includes("[SCRIPT]");
  const exactLine = detailed ? extractLine(request) : extractLine(input);
  return {
    classification: detailed ? "detailed_script" : request.trim().length < 80 ? "rough_idea" : "outline",
    requirements: {
      subject: { value: detailed ? "The supplied story" : "A short narrative video", provenance: detailed ? "explicit" : "inferred" },
      purpose: { value: "Tell a coherent short story", provenance: "inferred" },
      audience: { value: "General viewers", provenance: "project_preference" },
      durationSec: { value: 30, provenance: "project_preference" },
      format: { value: "9:16", provenance: "project_preference" },
      language: { value: "en", provenance: "project_preference" },
      tone: { value: "Naturalistic, restrained", provenance: "inferred" },
      requiredEvents: detailed
        ? [{ id: "event_required", description: "Keep every specified story event", provenance: "explicit" }]
        : [],
      exactDialogue: exactLine
        ? [{ speaker: exactLine.speaker, line: exactLine.line, provenance: "explicit" }]
        : [],
      factualClaims: [],
      ending: {
        value: detailed ? "The ending as written" : "She decides to open the door",
        provenance: detailed ? "explicit" : "proposed_addition",
      },
      suppliedAssets: { values: [], provenance: "explicit" },
      creativeFreedom: {
        value: detailed ? "Fill production gaps only" : "Story and visuals may be invented",
        provenance: detailed ? "explicit" : "inferred",
      },
    },
    assumptions: {
      assumptions: detailed
        ? []
        : [
            { id: "asm_place", text: "The story takes place in a small city apartment at night.", material: true },
            { id: "asm_letter", text: "The letter on the table is from someone she used to know.", material: true },
          ],
      proposedAdditions: detailed
        ? []
        : [{ id: "add_ending", kind: "other", text: "She opens the door instead of leaving the letter unread.", accepted: null }],
    },
      questions: {
      questions: detailed
        ? []
        : request.includes("delegate")
          ? []
          : [
              {
                id: "q_ending",
                text: "Should she open the letter, leave it, or be interrupted?",
                whyItMatters: "The ending changes the story.",
                options: ["Open it", "Leave it", "Someone knocks"],
                answer: null,
              },
            ],
    },
    brief: {
      visualStyle: "Naturalistic suspense",
      colorPalette: "Muted warm interiors, cool window light",
      lighting: "Warm practical lamps, dim overall",
      texture: "Lived-in apartment, paper, wood, fabric",
      cameraBehavior: "Restrained, mostly locked or slow push",
      performanceStyle: "Subtle, interior, few words",
      pacing: "Slow then a single decisive move",
      music: "Sparse low strings that grow",
      ambience: "Quiet room tone, distant traffic",
      emotionalProgression: "Unease to resolve",
      summary:
        "Naturalistic suspense, muted colors, warm practical lighting, restrained camera movement, subtle acting, quiet environmental sound, and gradually increasing tension.",
    },
    script: {
      title: detailed ? "The supplied script" : "The letter",
      logline: detailed ? "The user's story, ready to film." : "A woman waits with an unopened letter until she finally acts.",
      language: "en",
      scenes: [
        {
          id: "scene_1",
          order: 0,
          heading: "INT. APARTMENT – NIGHT",
          who: ["Maya"],
          where: "A small apartment living room",
          when: "Night",
          action: exactLine
            ? "Maya delivers the required line, then sits with the letter."
            : "Maya sits at the table, rereads the envelope, glances at the door, and finally stands.",
          change: "She moves from indecision to action.",
          viewerShould: "Feel the weight of waiting.",
          dialogue: exactLine
            ? [{ speaker: exactLine.speaker, line: exactLine.line }]
            : [{ speaker: "Maya", line: "I can't keep doing this." }],
          estimatedSec: 12,
        },
        {
          id: "scene_2",
          order: 1,
          heading: "INT. APARTMENT DOOR – NIGHT",
          who: ["Maya"],
          where: "The apartment door",
          when: "Moments later",
          action: "Maya walks to the door, pauses, and opens it.",
          change: "The wait ends.",
          viewerShould: "Feel a quiet release.",
          dialogue: [],
          estimatedSec: 10,
        },
      ],
    },
    durationFit: {
      estimatedSec: 22,
      targetSec: 30,
      fits: true,
      proposal: null,
    },
  };
};

const extractLine = (input: string) => {
  const match = input.match(/EXACT:\s*([^:]+):\s*(.+)$/m) || input.match(/^([A-Z][A-Za-z ]+):\s*(.+)$/m);
  if (!match) return null;
  return { speaker: match[1].trim(), line: match[2].trim() };
};

const defaultStructure = (retry = false): StructureOutput => {
  const voice = {
    provider: "elevenlabs",
    model: "eleven_v4",
    voiceId: "maya-en",
    language: "en",
    pronunciation: null,
    deliveryBaseline: "Quiet, close-miked, little projection",
  };
  return {
    characters: [
      {
        id: "char_maya",
        name: "Maya",
        appearance: "Woman in her thirties, dark hair tied back, tired eyes",
        clothing: "Olive knit sweater, gold necklace",
        distinguishingFeatures: "A thin scar on the left eyebrow",
        voice,
        performanceDirection: "Restrained; concern shown by a pause and a glance at the door",
        referenceAssetIds: [],
      },
    ],
    locations: [
      {
        id: "loc_apartment",
        name: "Maya's apartment",
        description: "Small living room with a wooden table, a lamp, and a door in the background",
        timeOfDay: "Night",
        weather: "Clear, city glow through the window",
        lighting: "Warm practical lamp, cooler window",
        layout: "Table foreground, door upstage right, window left",
        props: ["letter", "lamp", "chair"],
        referenceAssetIds: [],
      },
    ],
    props: [{ id: "prop_letter", name: "Letter", description: "Cream envelope with a handwritten name", referenceAssetIds: [] }],
    scenes: [
      {
        id: "scene_1",
        scriptSceneId: "scene_1",
        locationId: "loc_apartment",
        characterIds: ["char_maya"],
        time: "Night",
        weather: "Clear",
        lighting: "Warm practical",
        layout: "Table foreground, door in the background",
        props: ["letter", "lamp"],
        emotionalSituation: "Unease",
        purpose: "Establish waiting",
      },
      {
        id: "scene_2",
        scriptSceneId: "scene_2",
        locationId: "loc_apartment",
        characterIds: ["char_maya"],
        time: "Night",
        weather: "Clear",
        lighting: "Same lamp, slightly dimmer",
        layout: "Door becomes the subject",
        props: ["letter"],
        emotionalSituation: "Resolve",
        purpose: "She acts",
      },
    ],
    shots: [
      {
        id: "shot_1",
        sceneId: "scene_1",
        order: 0,
        purpose: "Watch her wait with the letter",
        editDurationSec: 8,
        generationDurationSec: 8,
        characterIds: ["char_maya"],
        propIds: ["prop_letter"],
        refs: [
          { targetId: "char_maya", targetKind: "character", role: "subject_ref" },
          { targetId: "loc_apartment", targetKind: "location", role: "style_ref" },
        ],
        framing: "Medium close-up, table height",
        cameraMotion: "Slow push in",
        action: "Maya rereads the envelope, pauses, glances toward the door",
        emotionalArc: "Unease gathering",
        audioSegmentIds: ["aud_dialogue_1", "aud_ambience", "aud_music"],
        continuity: "new_scene",
        dependsOn: null,
        speechMode: "lipsync",
        intendedBeginning: "Maya sits, letter in both hands",
        intendedEnding: "She looks toward the door and starts to stand",
        boundaryIn: {
          position: "seated at table",
          direction: "facing camera slightly left",
          speed: "still",
          gaze: "on the letter",
          camera: "medium close-up",
          props: ["letter"],
          incompleteAction: null,
        },
        boundaryOut: {
          position: "rising from the chair",
          direction: "toward the door, screen right",
          speed: "slow walk starting",
          gaze: "toward the door",
          camera: "medium close-up, slightly closer",
          props: ["letter"],
          incompleteAction: "standing up",
        },
      },
      {
        id: "shot_2",
        sceneId: "scene_1",
        order: 1,
        purpose: "New angle as she stands",
        editDurationSec: 6,
        generationDurationSec: 6,
        characterIds: ["char_maya"],
        propIds: ["prop_letter"],
        refs: [
          { targetId: "char_maya", targetKind: "character", role: "subject_ref" },
          { targetId: "loc_apartment", targetKind: "location", role: "style_ref" },
        ],
        framing: "Medium wide, table and door in frame",
        cameraMotion: "Static",
        action: "Maya stands and walks toward the door, letter in her right hand",
        emotionalArc: "Decision",
        audioSegmentIds: ["aud_ambience", "aud_music"],
        continuity: "new_angle",
        dependsOn: "shot_1",
        speechMode: "offscreen",
        intendedBeginning: "Maya mid-stand, turning toward the door",
        intendedEnding: "She reaches the door and her hand nears the knob",
        boundaryIn: {
          position: "rising from the chair",
          direction: "toward the door, screen right",
          speed: "slow walk starting",
          gaze: "toward the door",
          camera: "medium wide",
          props: ["letter"],
          incompleteAction: "standing up",
        },
        boundaryOut: {
          position: "at the door",
          direction: "facing the door",
          speed: "stopping",
          gaze: "on the knob",
          camera: "medium wide",
          props: ["letter"],
          incompleteAction: "reaching for the knob",
        },
      },
      {
        id: "shot_3",
        sceneId: "scene_2",
        order: 2,
        purpose: "Continue to the door opening",
        editDurationSec: 8,
        generationDurationSec: 8,
        characterIds: ["char_maya"],
        propIds: ["prop_letter"],
        refs: retry
          ? [{ targetId: "loc_apartment", targetKind: "location", role: "first_frame" }]
          : [
              { targetId: "char_maya", targetKind: "character", role: "subject_ref" },
              { targetId: "loc_apartment", targetKind: "location", role: "first_frame" },
            ],
        framing: "Over-shoulder toward the door",
        cameraMotion: "Hold, then a small push as the door opens",
        action: "Maya opens the door and looks out",
        emotionalArc: "Release",
        audioSegmentIds: ["aud_ambience", "aud_music", "aud_sfx_door"],
        continuity: "continue_shot",
        dependsOn: "shot_2",
        speechMode: "offscreen",
        intendedBeginning: "Hand on the knob at the accepted outgoing moment",
        intendedEnding: "Door open, she looks into the hall",
        boundaryIn: {
          position: "at the door",
          direction: "facing the door",
          speed: "stopping",
          gaze: "on the knob",
          camera: "over-shoulder",
          props: ["letter"],
          incompleteAction: "reaching for the knob",
        },
        boundaryOut: {
          position: "in the doorway",
          direction: "facing out",
          speed: "still",
          gaze: "into the hall",
          camera: "over-shoulder closer",
          props: ["letter"],
          incompleteAction: null,
        },
      },
    ],
    audioSegments: [
      {
        id: "aud_dialogue_1",
        track: "dialogue",
        shotIds: ["shot_1"],
        startOffsetSec: 1,
        durationSec: 3,
        text: "I can't keep doing this.",
        voiceId: "voice_maya",
        nativeAudioPolicy: "replace",
        fadeInSec: 0,
        fadeOutSec: 0,
        prompt: null,
        measuredDurationSec: null,
      },
      {
        id: "aud_music",
        track: "music",
        shotIds: ["shot_1", "shot_2", "shot_3"],
        startOffsetSec: 0,
        durationSec: 22,
        text: null,
        voiceId: null,
        nativeAudioPolicy: "replace",
        fadeInSec: 1,
        fadeOutSec: 2,
        prompt: "Sparse low strings that slowly increase tension then resolve",
        measuredDurationSec: null,
      },
      {
        id: "aud_ambience",
        track: "ambience",
        shotIds: ["shot_1", "shot_2", "shot_3"],
        startOffsetSec: 0,
        durationSec: 22,
        text: null,
        voiceId: null,
        nativeAudioPolicy: "mix",
        fadeInSec: 0.4,
        fadeOutSec: 0.4,
        prompt: "Quiet apartment room tone, distant traffic",
        measuredDurationSec: null,
      },
      {
        id: "aud_sfx_door",
        track: "sfx",
        shotIds: ["shot_3"],
        startOffsetSec: 4,
        durationSec: 1.5,
        text: null,
        voiceId: null,
        nativeAudioPolicy: "mix",
        fadeInSec: 0,
        fadeOutSec: 0.2,
        prompt: "Wooden apartment door opening",
        measuredDurationSec: null,
      },
    ],
    voices: [{ id: "voice_maya", characterId: "char_maya", identity: voice, previewOnly: false }],
  };
};

export const createMockPlanner = (handlers: MockPlannerHandlers = {}): Planner => ({
  run: async <T extends z.ZodType>(request: PlannerRequest<T>): Promise<PlannerResult<z.infer<T>>> => {
    const provider = plannerProvider();
    const model = plannerModelFor(request.task, provider);
    const raw =
      request.task === "structure"
        ? (handlers.structure?.(request.input) ?? defaultStructure(/failed these checks/i.test(request.input)))
        : (handlers.develop?.(request.input) ?? defaultDevelop(request.input));
    const output = request.schema.parse(raw) as z.infer<T>;
    return {
      output,
      model,
      provider,
      usage: { inputTokens: 800, outputTokens: 1200, usd: 0.01, latencyMs: 5 },
      repaired: false,
      cached: false,
    };
  },
});

export const mockDevelop = defaultDevelop;
export const mockStructure = defaultStructure;
