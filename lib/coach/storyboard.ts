import { PICTURE_CREDITS } from "@/lib/coach/picture-preview";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";

/** A revision can redo one frame. A new video usually sends two or more. */
export const MIN_STORYBOARD_SCENES = 1;
export const MAX_STORYBOARD_SCENES = 6;

/** One generated still, same price as any other picture. */
export const STORYBOARD_FRAME_CREDITS = PICTURE_CREDITS;

export interface StoryboardFrameView {
  index: number;
  seconds: number;
  beat: string;
  url?: string;
}

const sceneCount = (input: Record<string, unknown>) => {
  if (!Array.isArray(input.scenes)) return null;
  const count = input.scenes.length;
  if (count < MIN_STORYBOARD_SCENES || count > MAX_STORYBOARD_SCENES) return null;
  return count;
};

/** Credits a storyboard call will hold, or null when the scene list is not usable. */
export const storyboardCreditsFor = (input: Record<string, unknown>) => {
  const count = sceneCount(input);
  if (count === null) return null;
  return count * STORYBOARD_FRAME_CREDITS;
};

export const storyboardFormat = (input: Record<string, unknown>): VideoFormat => {
  const format = input.format;
  if (typeof format === "string" && (VIDEO_FORMATS as readonly string[]).includes(format)) return format as VideoFormat;
  return "9:16";
};

const frameView = (value: unknown, index: number, requireUrl: boolean): StoryboardFrameView | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const seconds = typeof row.seconds === "number" && Number.isFinite(row.seconds) ? row.seconds : 0;
  const beat = typeof row.beat === "string" ? row.beat.trim() : "";
  const url = typeof row.url === "string" && row.url ? row.url : undefined;
  if (requireUrl && !url) return null;
  if (!beat && seconds <= 0 && !url) return null;
  return {
    index: typeof row.index === "number" ? row.index : index + 1,
    seconds,
    beat,
    url,
  };
};

/** Frames the tool already generated. */
export const storyboardFramesFromOutput = (output: unknown): StoryboardFrameView[] => {
  if (!output || typeof output !== "object") return [];
  const frames = (output as { frames?: unknown }).frames;
  if (!Array.isArray(frames)) return [];
  return frames.flatMap((frame, index) => {
    const view = frameView(frame, index, true);
    return view ? [view] : [];
  });
};

/** Scenes the tool was given, shown as skeletons while the frames generate. */
export const storyboardFramesFromInput = (input: Record<string, unknown>): StoryboardFrameView[] => {
  if (!Array.isArray(input.scenes)) return [];
  return input.scenes.flatMap((scene, index) => {
    const view = frameView(scene, index, false);
    return view ? [view] : [];
  });
};
