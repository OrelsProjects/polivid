/** One line on an approved brief listing the settings they changed on the card. */
export const BRIEF_EDIT_NOTE_PREFIX = "Brief changes:";

export interface BriefEdits {
  mode?: string;
  format?: string;
  length?: string;
  preset?: string;
  tier?: string;
  /** How many clips to film. */
  clips?: string;
}

const KEYS = ["mode", "format", "length", "preset", "tier", "clips"] as const;

export const briefEditNote = (edits: BriefEdits) => {
  const pairs = KEYS.filter((key) => edits[key]).map((key) => `${key}=${edits[key]}`);
  return pairs.length > 0 ? `${BRIEF_EDIT_NOTE_PREFIX} ${pairs.join("; ")}` : "";
};

export const proseWithoutBriefEditNote = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith(BRIEF_EDIT_NOTE_PREFIX))
    .join("\n")
    .trim();

/** The clip count on a "Brief changes:" line in this message, or undefined. */
export const clipsFromMessage = (message: { parts: readonly { type: string; text?: string }[] }) => {
  let clips: number | undefined;
  for (const part of message.parts) {
    if (part.type !== "text" || !part.text) continue;
    for (const raw of part.text.split("\n")) {
      const line = raw.trim();
      if (!line.startsWith(BRIEF_EDIT_NOTE_PREFIX)) continue;
      const match = line.match(/(?:^|[;\s])clips=(\d+)/);
      const value = match ? Number(match[1]) : NaN;
      if (Number.isInteger(value) && value > 0) clips = value;
    }
  }
  return clips;
};
