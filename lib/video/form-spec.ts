import { modeCanNarrate } from "@/lib/voice/constants";
import { isDirectMode, modeAcceptsReferenceImages, modeAllowsStills, type ModeUpload, type VideoMode } from "./modes";
import type { CreateTool, FormSection } from "./tool-catalog";

/** What the main box asks for. */
export type InputKind = "prompt" | "script" | "lyrics";

export interface FormSpec {
  input: InputKind;
  sections: ReadonlySet<FormSection>;
  /** The file this mode needs before it can run. */
  uploadKind: Exclude<ModeUpload, "none"> | null;
  /** A step the person approves before anything is filmed. */
  planFirst: "shots" | "song" | null;
  /** Looks offered. Null means every look the engine allows. */
  presetIds: readonly string[] | null;
  /** The tool starts from a link, so the link field is open when the form loads. */
  linkFirst: boolean;
  /** False when the mode has nothing to write, such as a quick edit. */
  showPrompt: boolean;
  /** The tool makes one kind of edit, so only its setting is offered. */
  lockOp: boolean;
}

/**
 * Which parts of the create form a mode shows, narrowed by the tool on top of it.
 * The form reads this instead of testing mode ids in each section.
 */
export const formSpecFor = (mode: VideoMode | null, tool?: CreateTool | null): FormSpec => {
  const sections = new Set<FormSection>();
  if (mode?.id === "edit") {
    // A quick edit changes one thing about an upload. There is nothing to write, style, or voice.
    sections.add("op");
  } else if (isDirectMode(mode?.id)) {
    // The prompt is sent as typed. Only what the model itself needs is asked: shape, length, and which model.
    sections.add("format");
    sections.add("length");
    sections.add("tier");
    sections.add("model");
  } else if (mode?.engine === "compose") {
    // Captions and the like work on an upload as it is. Its shape and length come from the file.
  } else {
    sections.add("look");
    sections.add("format");
    sections.add("length");
    if (!mode || modeAcceptsReferenceImages(mode)) sections.add("references");
    if (mode?.id !== "lyrics" && mode?.id !== "captions") sections.add("showText");
    if (mode?.id !== "lyrics") sections.add("visualDirection");
    if (mode) sections.add("tier");
    if (!mode || mode.engine === "video") sections.add("model");
    if (modeCanNarrate(mode?.id)) sections.add("character");
    if (mode?.id !== "prompt" && mode?.id !== "lyrics") sections.add("improve");
    if (modeAllowsStills(mode)) sections.add("media");
    if (mode?.spokenScript) sections.add("verbatim");
    if (mode?.spokenScript) sections.add("link");
  }
  for (const hidden of tool?.hide ?? []) sections.delete(hidden);

  return {
    input: mode?.id === "lyrics" ? "lyrics" : mode?.id === "shorts" ? "script" : "prompt",
    sections,
    uploadKind: mode && mode.upload !== "none" ? mode.upload : null,
    planFirst: mode?.id === "lyrics" ? "song" : mode?.id === "prompt" ? "shots" : null,
    presetIds: tool?.presets ?? null,
    linkFirst: tool?.input === "link" && sections.has("link"),
    showPrompt: mode?.engine !== "compose",
    lockOp: tool?.lockOp === true,
  };
};
