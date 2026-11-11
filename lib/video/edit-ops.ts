import { dimensionsFor, VIDEO_FORMATS, type VideoFormat } from "./schema";

/**
 * Quick edits: one plain change to an uploaded video. No model is involved; each one is
 * a single ffmpeg pass, so they cost the same whatever the clip is.
 */
export const EDIT_OPS = ["rotate", "flip", "resize", "loop", "volume"] as const;
export type EditOp = (typeof EDIT_OPS)[number];

/** Stored as the job's model, the way an export stores `editor`. */
export const EDIT_MODEL = "edit";
export const EDIT_LABEL = "Quick edit";
export const EDIT_CREDITS = 10;

export const isEditOp = (value: unknown): value is EditOp =>
  typeof value === "string" && (EDIT_OPS as readonly string[]).includes(value);

interface EditChoice {
  label: string;
  /** Says what the person gets, shown under the buttons. */
  hint: string;
  values: readonly { value: string; label: string }[];
  defaultValue: string;
}

export const EDIT_CHOICES: Record<EditOp, EditChoice> = {
  rotate: {
    label: "Rotate",
    hint: "Turns the picture clockwise. Use it for a video filmed sideways or upside down.",
    values: [
      { value: "90", label: "90°" },
      { value: "180", label: "180°" },
      { value: "270", label: "270°" },
    ],
    defaultValue: "90",
  },
  flip: {
    label: "Flip",
    hint: "Mirrors the picture. Text in the video will read backwards.",
    values: [
      { value: "horizontal", label: "Left to right" },
      { value: "vertical", label: "Top to bottom" },
    ],
    defaultValue: "horizontal",
  },
  resize: {
    label: "Resize",
    hint: "Fill crops the edges to fill the new shape. Fit keeps the whole picture over a blurred copy of itself.",
    values: VIDEO_FORMATS.flatMap((format) => [
      { value: `${format}:crop`, label: `${format} fill` },
      { value: `${format}:pad`, label: `${format} fit` },
    ]),
    defaultValue: "9:16:pad",
  },
  loop: {
    label: "Loop",
    hint: "Plays the video this many times in a row.",
    values: [
      { value: "2", label: "2 times" },
      { value: "3", label: "3 times" },
      { value: "4", label: "4 times" },
      { value: "5", label: "5 times" },
    ],
    defaultValue: "3",
  },
  volume: {
    label: "Volume",
    hint: "Makes the sound louder or quieter, or removes it.",
    values: [
      { value: "0", label: "Mute" },
      { value: "50", label: "Half" },
      { value: "150", label: "Louder" },
      { value: "200", label: "Twice as loud" },
    ],
    defaultValue: "150",
  },
};

/** The value to use for this edit: the one asked for when it is offered, otherwise the default. */
export const editValueFor = (op: EditOp, value: string | null | undefined) =>
  EDIT_CHOICES[op].values.some((choice) => choice.value === value) ? (value as string) : EDIT_CHOICES[op].defaultValue;

export const isEditValue = (op: EditOp, value: unknown): value is string =>
  typeof value === "string" && EDIT_CHOICES[op].values.some((choice) => choice.value === value);

/** One line for the library and the job details, such as "Rotate 90°". */
export const describeEdit = (op: EditOp, value: string) => {
  const choice = EDIT_CHOICES[op].values.find((entry) => entry.value === value);
  return `${EDIT_CHOICES[op].label} · ${choice?.label ?? value}`;
};

/** How many times longer the result runs than the upload. */
export const editLengthFactor = (op: EditOp, value: string) => (op === "loop" ? Math.max(1, Number(value) || 1) : 1);

/** The shape of the result, when the edit sets one. */
export const editFormat = (op: EditOp, value: string): VideoFormat | null => {
  if (op !== "resize") return null;
  const format = value.split(":").slice(0, 2).join(":");
  return (VIDEO_FORMATS as readonly string[]).includes(format) ? (format as VideoFormat) : null;
};

const ENCODE = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

/**
 * The ffmpeg arguments for one edit. Sound is copied untouched whenever the picture is
 * what changes, and the picture is copied untouched whenever the sound is.
 */
export const editFfmpegArgs = (input: {
  op: EditOp;
  value: string;
  source: string;
  output: string;
  hasAudio: boolean;
}): string[] => {
  const { op, source, output, hasAudio } = input;
  const value = editValueFor(op, input.value);
  const keepSound = hasAudio ? ["-c:a", "copy"] : ["-an"];

  if (op === "rotate") {
    const turn = value === "180" ? "hflip,vflip" : value === "270" ? "transpose=2" : "transpose=1";
    return ["-y", "-i", source, "-vf", turn, ...ENCODE, "-metadata:s:v:0", "rotate=0", ...keepSound, output];
  }
  if (op === "flip") {
    return ["-y", "-i", source, "-vf", value === "vertical" ? "vflip" : "hflip", ...ENCODE, ...keepSound, output];
  }
  if (op === "resize") {
    const { width, height } = dimensionsFor(editFormat(op, value) ?? "9:16");
    if (value.endsWith(":crop")) {
      const fill = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
      return ["-y", "-i", source, "-vf", fill, ...ENCODE, ...keepSound, output];
    }
    const graph = [
      "[0:v]split=2[back][front]",
      `[back]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=30[blurred]`,
      `[front]scale=${width}:${height}:force_original_aspect_ratio=decrease[fitted]`,
      "[blurred][fitted]overlay=(W-w)/2:(H-h)/2,setsar=1[out]",
    ].join(";");
    return ["-y", "-i", source, "-filter_complex", graph, "-map", "[out]", "-map", "0:a?", ...ENCODE, ...keepSound, output];
  }
  if (op === "loop") {
    const extra = Math.max(1, Number(value) || 1) - 1;
    return ["-y", "-stream_loop", String(extra), "-i", source, "-c", "copy", "-movflags", "+faststart", output];
  }
  if (value === "0" || !hasAudio) {
    return ["-y", "-i", source, "-c:v", "copy", "-an", "-movflags", "+faststart", output];
  }
  return [
    "-y",
    "-i",
    source,
    "-c:v",
    "copy",
    "-af",
    `volume=${(Number(value) / 100).toFixed(2)}`,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    output,
  ];
};
