import {
  addTextEdit,
  addTrackEdit,
  audioEdit,
  crossfadeEdit,
  duplicateEdit,
  imageMotionEdit,
  moveEdit,
  removeCaptionsEdit,
  removeEdit,
  removeTrackEdit,
  reorderTrackEdit,
  setFormatEdit,
  setVolumeEdit,
  splitEdit,
  styleCaptionsEdit,
  styleTextEdit,
  transformEdit,
  transitionEdit,
  trimEdit,
  updateTextEdit,
  updateTrackEdit,
  type EditChange,
  type TextPosition,
  type TextStyleInput,
  type TransitionEdge,
} from "@/lib/editor/coach-edits";
import {
  AUDIO_ROLES,
  FIT_MODES,
  IMAGE_MOTIONS,
  TEXT_ALIGNS,
  TEXT_ANIMATIONS,
  TRACK_KINDS,
  TRANSITION_TYPES,
  type AudioRole,
  type FitMode,
  type ImageMotionKind,
  type TextAlign,
  type TextAnimationType,
  type Timeline,
  type TrackKind,
  type TransitionType,
} from "@/lib/editor/schema";
import type { BATCHABLE_EDITS } from "@/lib/tools/defs/edit";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";

type Row = Record<string, unknown>;

/** One timeline edit, ready to run against the saved timeline. */
export interface EditPlan {
  summary: string;
  edit: (timeline: Timeline) => EditChange;
  /** A new project title, for edit_set_project. */
  title?: string;
}

export class EditInputError extends Error {}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const bool = (value: unknown) => (typeof value === "boolean" ? value : undefined);
const oneOf = <T extends string>(values: readonly T[], value: unknown): T | undefined =>
  typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : undefined;
const position = (value: unknown) => oneOf<TextPosition>(["top", "center", "bottom"], value);

const required = (value: string, message: string) => {
  if (!value) throw new EditInputError(message);
  return value;
};

const animation = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Row;
  const type = oneOf<TextAnimationType>(TEXT_ANIMATIONS, row.type);
  return type ? { type, seconds: num(row.seconds) } : undefined;
};

const textStyle = (row: Row): TextStyleInput => ({
  fontFamily: str(row.fontFamily) || undefined,
  fontSize: num(row.fontSize),
  fontWeight: num(row.fontWeight),
  color: str(row.color) || undefined,
  background: row.background === null ? null : typeof row.background === "string" ? row.background : undefined,
  align: oneOf<TextAlign>(TEXT_ALIGNS, row.align),
  position: position(row.position),
  animationIn: animation(row.animationIn),
  animationOut: animation(row.animationOut),
});

type BatchableEdit = (typeof BATCHABLE_EDITS)[number];

/** Turns tool arguments into a timeline edit. Throws EditInputError for arguments the agent can fix. */
export const EDIT_BUILDERS: Record<BatchableEdit, (row: Row) => EditPlan> = {
  edit_add_text: (row) => {
    const words = required(str(row.text), "Pass the words to show.");
    return {
      summary: `Added “${words}”.`,
      edit: (timeline) =>
        addTextEdit(timeline, { text: words, startSec: num(row.startSec), endSec: num(row.endSec), position: position(row.position) }),
    };
  },
  edit_update_text: (row) => {
    const itemId = required(str(row.itemId), "Pass the text clip id.");
    return {
      summary: "Updated the title.",
      edit: (timeline) => updateTextEdit(timeline, { itemId, text: str(row.text) || undefined, position: position(row.position) }),
    };
  },
  edit_trim: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id.");
    return {
      summary: "Trimmed the clip.",
      edit: (timeline) => trimEdit(timeline, { itemId, startSec: num(row.startSec), endSec: num(row.endSec) }),
    };
  },
  edit_split: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id and where to split.");
    const atSec = num(row.atSec);
    if (atSec == null) throw new EditInputError("Pass the clip id and where to split.");
    return { summary: "Split the clip.", edit: (timeline) => splitEdit(timeline, { itemId, atSec }) };
  },
  edit_remove: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id.");
    return { summary: "Removed the clip.", edit: (timeline) => removeEdit(timeline, { itemId, ripple: row.ripple === true }) };
  },
  edit_move: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id.");
    const startSec = num(row.startSec);
    const trackId = str(row.trackId) || undefined;
    if (startSec == null && !trackId) throw new EditInputError("Pass a new start, a track, or both.");
    return { summary: "Moved the clip.", edit: (timeline) => moveEdit(timeline, { itemId, startSec, trackId }) };
  },
  edit_set_volume: (row) => ({
    summary: "Updated the volume.",
    edit: (timeline) =>
      setVolumeEdit(timeline, {
        itemId: str(row.itemId) || undefined,
        trackId: str(row.trackId) || undefined,
        volume: num(row.volume),
        muted: bool(row.muted),
      }),
  }),
  edit_set_project: (row) => {
    const title = str(row.title) || undefined;
    const format = oneOf<VideoFormat>(VIDEO_FORMATS, row.format);
    if (!title && !format) throw new EditInputError("Pass a title, a format, or both.");
    return {
      summary: [title ? `Renamed to “${title}”` : "", format ? `Changed the frame to ${format}` : ""].filter(Boolean).join(". ") + ".",
      title,
      edit: (timeline) => (format ? setFormatEdit(timeline, format) : { timeline, changedItemIds: [] }),
    };
  },
  edit_add_track: (row) => {
    const kind = oneOf<TrackKind>(TRACK_KINDS, row.kind);
    if (!kind) throw new EditInputError("Pass kind: visual, text, or audio.");
    return { summary: `Added a ${kind} track.`, edit: (timeline) => addTrackEdit(timeline, { kind, name: str(row.name), index: num(row.index) }) };
  },
  edit_update_track: (row) => {
    const trackId = required(str(row.trackId), "Pass the track id.");
    return {
      summary: "Updated the track.",
      edit: (timeline) =>
        updateTrackEdit(timeline, { trackId, name: str(row.name) || undefined, muted: bool(row.muted), hidden: bool(row.hidden), locked: bool(row.locked) }),
    };
  },
  edit_remove_track: (row) => {
    const trackId = required(str(row.trackId), "Pass the track id.");
    return { summary: "Removed the track.", edit: (timeline) => removeTrackEdit(timeline, { trackId }) };
  },
  edit_reorder_track: (row) => {
    const trackId = required(str(row.trackId), "Pass the track id.");
    const index = num(row.index);
    if (index == null) throw new EditInputError("Pass the new index.");
    return { summary: "Reordered the tracks.", edit: (timeline) => reorderTrackEdit(timeline, { trackId, index }) };
  },
  edit_duplicate: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id.");
    return {
      summary: "Duplicated the clip.",
      edit: (timeline) => duplicateEdit(timeline, { itemId, startSec: num(row.startSec), trackId: str(row.trackId) || undefined }),
    };
  },
  edit_crossfade: (row) => {
    const firstId = required(str(row.firstId), "Pass both clip ids.");
    const secondId = required(str(row.secondId), "Pass both clip ids.");
    return { summary: "Crossfaded the clips.", edit: (timeline) => crossfadeEdit(timeline, { firstId, secondId, seconds: num(row.seconds) }) };
  },
  edit_set_transition: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id.");
    const type = oneOf<TransitionType | "none">([...TRANSITION_TYPES, "none"], row.type);
    if (!type) throw new EditInputError("Pass type: fade, slide, wipe, zoom, or none.");
    const edge = oneOf<TransitionEdge>(["in", "out", "both"], row.edge);
    return {
      summary: type === "none" ? "Removed the transition." : `Set a ${type} transition.`,
      edit: (timeline) => transitionEdit(timeline, { itemId, type, edge, seconds: num(row.seconds) }),
    };
  },
  edit_set_transform: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id.");
    return {
      summary: "Moved and resized the clip.",
      edit: (timeline) =>
        transformEdit(timeline, {
          itemId,
          x: num(row.x),
          y: num(row.y),
          scale: num(row.scale),
          rotation: num(row.rotation),
          fit: oneOf<FitMode>(FIT_MODES, row.fit),
          opacity: num(row.opacity),
          fillFrame: row.fillFrame === true,
        }),
    };
  },
  edit_style_text: (row) => {
    const itemIds = Array.isArray(row.itemIds) ? row.itemIds.map(str).filter(Boolean) : [];
    if (itemIds.length === 0) throw new EditInputError("Pass the text clip ids.");
    return { summary: "Restyled the text.", edit: (timeline) => styleTextEdit(timeline, { itemIds, ...textStyle(row) }) };
  },
  edit_style_captions: (row) => ({ summary: "Restyled the captions.", edit: (timeline) => styleCaptionsEdit(timeline, textStyle(row)) }),
  edit_remove_captions: () => ({ summary: "Removed the captions.", edit: (timeline) => removeCaptionsEdit(timeline) }),
  edit_set_audio: (row) => {
    const itemId = required(str(row.itemId), "Pass the clip id.");
    return {
      summary: "Updated the sound.",
      edit: (timeline) =>
        audioEdit(timeline, {
          itemId,
          volume: num(row.volume),
          fadeInSec: num(row.fadeInSec),
          fadeOutSec: num(row.fadeOutSec),
          role: oneOf<AudioRole>(AUDIO_ROLES, row.role),
        }),
    };
  },
  edit_set_image_motion: (row) => {
    const itemId = required(str(row.itemId), "Pass the picture clip id.");
    const motion = oneOf<ImageMotionKind | "none">([...IMAGE_MOTIONS, "none"], row.motion);
    if (!motion) throw new EditInputError(`Pass motion: ${IMAGE_MOTIONS.join(", ")}, or none.`);
    return { summary: "Set the camera move.", edit: (timeline) => imageMotionEdit(timeline, { itemId, motion, amount: num(row.amount) }) };
  },
};

/** Several plans as one edit. Changed ids are merged; the last title wins. */
export const combinePlans = (plans: EditPlan[]): EditPlan => ({
  summary: plans.map((plan) => plan.summary).join(" "),
  title: plans.reduce<string | undefined>((title, plan) => plan.title ?? title, undefined),
  edit: (timeline) => {
    let next = timeline;
    const changed = new Set<string>();
    for (const plan of plans) {
      const change = plan.edit(next);
      next = change.timeline;
      for (const id of change.changedItemIds) changed.add(id);
    }
    return { timeline: next, changedItemIds: [...changed] };
  },
});
