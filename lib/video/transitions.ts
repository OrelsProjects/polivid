/**
 * Smooth transitions: in a video stitched from several clips, each clip after the first starts on
 * the last frame of the clip before, and the model is told to carry on from it instead of cutting.
 *
 * Nothing here touches the network, so the form, the tools and the worker agree on it.
 */
import { isStitchedMode } from "./segments";

/** Stitched modes the setting changes. A lyrics video cuts on the music, so it is left out. */
export const smoothTransitionsApply = (mode: string | null | undefined) => Boolean(mode) && mode !== "lyrics" && isStitchedMode(mode!);

/** Whether this video's clips run on from one another: yes, unless asked not to. */
export const usesSmoothTransitions = (mode: string | null | undefined, asked: boolean | null | undefined) => {
  if (!smoothTransitionsApply(mode)) return false;
  return typeof asked === "boolean" ? asked : true;
};

/**
 * The prompt for a clip that starts on the previous clip's last frame. It says that frame is a
 * continuation to match exactly, how to get from it into this shot without a cut, and then gives the
 * shot itself, unchanged.
 */
export const continuationPrompt = (shot: string) =>
  [
    "CONTINUOUS SHOT. The first frame you are given is the very last frame of the previous shot. This shot picks up from it with no cut.",
    "- Start exactly on that frame: the same characters with the same look, pose and expression, the same place, light, colours and art style, and the same camera position and lens. No cut, fade, flash, zoom jump or change of style on the first frame.",
    "- Carry on any movement already happening in that frame, then move the characters and the camera naturally into what this shot is about.",
    "- If this shot happens somewhere else, get there within the shot: the character walks, turns or moves into it, or the camera pans, tracks or pushes through to it. Never swap the scene in a single frame.",
    "- Reach this shot's main action early, within about the first second, and spend the rest of the shot on it.",
    "",
    "THIS SHOT:",
    shot.trim(),
  ].join("\n");
