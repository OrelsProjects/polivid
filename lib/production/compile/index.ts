import type { CreativeBrief, Observation, SceneRecord, Shot } from "../schema";

export interface CompileContext {
  brief: CreativeBrief;
  scene: SceneRecord;
  shot: Shot;
  observation?: Observation | null;
  characterNotes: string[];
  locationNotes: string;
}

export const compileShotPrompt = (context: CompileContext) => {
  const parts = [
    context.shot.action,
    `Camera: ${context.shot.framing}. ${context.shot.cameraMotion}.`,
    `Emotion: ${context.shot.emotionalArc}.`,
  ];
  const lastFrame = context.observation?.lastFrameDescription?.trim();
  if (context.shot.continuity === "continue_shot") {
    parts.unshift("Uninterrupted continuation of the same camera view. Continuous action and camera behavior. Do not recap or reset.");
    if (context.observation) {
      if (lastFrame) {
        parts.push(
          `The attached first frame is the exact final frame of the previous clip. It shows: ${lastFrame} Begin from precisely this frame with identical framing, wardrobe, lighting, props and positions, then continue the motion without a cut.`,
        );
      }
      parts.push(
        `Start from the accepted outgoing moment: ${context.observation.boundaryOut.position}, ${context.observation.boundaryOut.direction}, ${context.observation.boundaryOut.speed}, gaze ${context.observation.boundaryOut.gaze}.`,
      );
      if (context.observation.incompleteActions[0]) {
        parts.push(`Complete this action: ${context.observation.incompleteActions.join("; ")}.`);
      }
    }
  } else if (context.shot.continuity === "new_angle") {
    parts.unshift(`New angle in the same scene. ${context.locationNotes}`);
    parts.push(...context.characterNotes);
    if (lastFrame) {
      parts.push(
        `The previous clip ended on this exact frame: ${lastFrame} Keep the same people, wardrobe, props, room and lighting; only the camera position changes.`,
      );
    }
  } else {
    parts.unshift(`New scene. ${context.locationNotes}`);
    parts.push(...context.characterNotes);
  }
  parts.push(`Intended beginning: ${context.shot.intendedBeginning}.`);
  parts.push(`Intended ending: ${context.shot.intendedEnding}.`);
  return parts.filter(Boolean).join(" ");
};

export const compileImagePrompt = (subject: string, brief: CreativeBrief) =>
  `${subject}. ${brief.visualStyle}. ${brief.colorPalette}. ${brief.lighting}. ${brief.texture}. Still frame, no text.`;
