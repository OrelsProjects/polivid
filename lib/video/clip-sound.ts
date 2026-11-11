export type ClipSoundKind = "layer" | "mixed" | "model" | "song" | "unknown";

export interface ClipSound {
  kind: ClipSoundKind;
  /** What to tell the Coach about this clip's sound. */
  note: string;
  /** The script that was mixed in, when a voice was added after filming. */
  spoken?: string;
}

const LAYER =
  "The voice is the Voiceover clip on the Audio track. Remove that clip with edit_remove, or turn it down with edit_set_volume. Both are free. Do not start a new video to drop the voice.";

const MIXED =
  "This older video mixed the voice into the clip and replaced the original sound. The Audio track is empty. Set the video clip's volume to 0 to silence it. That drops every sound in the clip. Do not start a new video just to drop the voice.";

const MODEL =
  "No voice was added after filming. The video clip's own sound is the filmed take. edit_read_timeline marks that item sound.footage. An empty Audio track does not mean a voiceover was mixed in.";

const SONG =
  "This lyrics video has the song inside the video clip. The Audio track is empty unless more audio was added later. Setting the video clip's volume to 0 silences the song too.";

const UNKNOWN =
  "This cut was not opened from a filmed job. Any sound is inside the video file. An empty Audio track means nothing extra was layered on.";

export const spokenFromArtifacts = (artifacts: unknown) => {
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return "";
  const spoken = (artifacts as Record<string, unknown>).spoken;
  return typeof spoken === "string" ? spoken.trim() : "";
};

/** Where the sound in a finished clip came from. Footage models do not record a voiceover. */
export const describeClipSound = (input: {
  found: boolean;
  mode?: string | null;
  spoken?: string | null;
  hasVoice: boolean;
  /** The voice file is stored beside the footage. */
  layered?: boolean;
}): ClipSound => {
  if (!input.found) return { kind: "unknown", note: UNKNOWN };
  const spoken = input.spoken?.trim().slice(0, 400) ?? "";
  if (input.layered) return { kind: "layer", note: LAYER, ...(spoken ? { spoken } : {}) };
  if (input.mode === "lyrics") return { kind: "song", note: SONG };
  if (input.hasVoice && spoken) return { kind: "mixed", note: MIXED, spoken };
  return { kind: "model", note: MODEL };
};
