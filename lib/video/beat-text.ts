/** About 2.5 spoken words fit in one second. */
export const wordsForSeconds = (seconds: number) => Math.max(1, Math.round(Math.max(0, seconds) * 2.5));

export const trimToWords = (text: string, maxWords: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, Math.max(1, maxWords)).join(" ");
};

/**
 * The `vo` field is empty, or the coach passed the field value `none`.
 * Anything else is spoken text. The prompt is not read for this.
 */
export const voiceoverDeclined = (vo: string | undefined) => {
  const line = (vo ?? "").trim().toLowerCase();
  if (line === "none") return true;
  return vo !== undefined && line.length === 0;
};

/**
 * The words to speak, or null when the video should stay silent.
 * An approved `vo` line wins. `none` and an empty `vo` stay silent.
 * When `vo` was not passed, a prompt video speaks the per-cut actions.
 * A voiceover video speaks its script.
 */
export const narrationSource = (input: {
  mode?: string;
  vo?: string;
  prompt: string;
  voiceover?: string;
  actions?: readonly string[];
}) => {
  if (input.mode === "lyrics") return input.prompt.trim() || null;
  if (input.mode === "shorts") return input.prompt.trim() || null;
  if (input.mode === "voiceover") {
    const script = input.voiceover?.trim() || "";
    if (script) return script;
    if (voiceoverDeclined(input.vo)) return null;
    return input.vo?.trim() || null;
  }
  if (voiceoverDeclined(input.vo)) return null;
  const line = input.vo?.trim() ?? "";
  if (line) return line;
  const actions = (input.actions ?? []).map((action) => action.trim()).filter(Boolean);
  return actions.length > 0 ? actions.join("\n") : null;
};

/** One spoken line per clip, using that clip's seconds. A missing length uses the last known clip, then the video length. */
export const voiceBeatTimings = (beats: readonly string[], seconds: readonly number[], fallbackSeconds: number) => {
  const last = seconds.at(-1) ?? fallbackSeconds;
  return beats.map((text, index) => ({
    text,
    seconds: seconds[index] ?? last,
  }));
};

export const voiceBeatTotal = (timings: readonly { seconds: number }[]) =>
  timings.reduce((sum, beat) => sum + beat.seconds, 0);

/** Used only when the model cannot split the prompt. Later clips do not repeat the whole request. */
export const fallbackBeats = (prompt: string, segments: readonly number[]) => {
  if (segments.length <= 1) return [prompt];
  return segments.map(
    (seconds, index) =>
      index === 0
        ? prompt
        : `Continue into the next moment for ${seconds} seconds. Do not replay earlier events.`,
  );
};
