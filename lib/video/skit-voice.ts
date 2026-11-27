/**
 * A skit's voice is one take: the whole script read in a single go, so it flows like one person
 * talking. The picture follows the voice: each shot is on screen from where its words start to
 * where the next beat's words start, plus any silence the script asks for after its line.
 *
 * Nothing here touches the network, so it can be tested on its own.
 */

/** One beat as it is read: its words, and the seconds of silence held after them. */
export interface SkitVoiceLine {
  say: string;
  /** Seconds of silence after the line: the script's pauses plus any hold the plan gave the shot. */
  after: number;
}

/** When each character of the spoken text is said, in seconds. */
export interface CharacterTimes {
  characters: readonly string[];
  starts: readonly number[];
  ends: readonly number[];
}

/** The text read in one take, and where each beat's words sit in it. */
export const skitVoiceText = (lines: readonly SkitVoiceLine[]) => {
  let text = "";
  const ranges: [number, number][] = [];
  for (const line of lines) {
    const say = line.say.trim();
    if (text && say) text += " ";
    const start = text.length;
    text += say;
    ranges.push([start, text.length]);
  }
  return { text, ranges };
};

const firstSpoken = (text: string, [start, end]: [number, number]) => {
  for (let index = start; index < end; index += 1) if (text[index]?.trim()) return index;
  return -1;
};

const lastSpoken = (text: string, [start, end]: [number, number]) => {
  for (let index = end - 1; index >= start; index -= 1) if (text[index]?.trim()) return index;
  return -1;
};

/**
 * Where the voice moves from one beat to the next, from the start of the take to its end. A cut
 * falls halfway through the breath between two lines, so no word is clipped. Null when the timings
 * don't match the text, or a beat has no words.
 */
export const beatCutTimes = (
  text: string,
  ranges: readonly [number, number][],
  times: CharacterTimes,
  totalSec: number,
): number[] | null => {
  if (ranges.length === 0 || times.characters.length !== text.length) return null;
  if (times.characters.join("") !== text) return null;
  const spans = ranges.map((range) => {
    const first = firstSpoken(text, range);
    const last = lastSpoken(text, range);
    if (first < 0 || last < 0) return null;
    return { start: times.starts[first]!, end: times.ends[last]! };
  });
  if (spans.some((span) => !span)) return null;
  const lastEnd = spans.at(-1)!.end;
  const cuts = [0];
  for (let index = 1; index < spans.length; index += 1) {
    const before = spans[index - 1]!.end;
    const after = spans[index]!.start;
    const cut = (Math.min(before, after) + Math.max(before, after)) / 2;
    // Timings that run backwards can't be cut; the voice is read beat by beat instead.
    if (!(cut > cuts.at(-1)!)) return null;
    cuts.push(cut);
  }
  const end = Math.max(totalSec, lastEnd);
  if (!(end > cuts.at(-1)!)) return null;
  cuts.push(end);
  return cuts;
};

/** How long each shot is on screen: its stretch of the take plus the silence after its line. */
export const shotSpans = (cuts: readonly number[], lines: readonly SkitVoiceLine[]) =>
  lines.map((line, index) => Math.max(0.5, cuts[index + 1]! - cuts[index]! + Math.max(0, line.after)));

const seconds = (value: number) => Math.max(0, value).toFixed(3);

/**
 * Cuts the take at each beat and holds that beat's silence before the next line, so the voice
 * still lines up with the shots when the script asks for pauses.
 */
export const heldVoiceArgs = (audio: string, output: string, cuts: readonly number[], lines: readonly SkitVoiceLine[]) => {
  const parts = lines.map((line, index) => {
    const start = cuts[index]!;
    const last = index === lines.length - 1;
    const trim = last ? `atrim=start=${seconds(start)}` : `atrim=start=${seconds(start)}:end=${seconds(cuts[index + 1]!)}`;
    const pad = line.after > 0 ? `,apad=pad_dur=${seconds(line.after)}` : "";
    return `[0:a]${trim},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo${pad}[p${index}]`;
  });
  const joined = `${lines.map((_, index) => `[p${index}]`).join("")}concat=n=${lines.length}:v=0:a=1[a]`;
  return ["-y", "-i", audio, "-filter_complex", [...parts, joined].join(";"), "-map", "[a]", "-c:a", "libmp3lame", "-b:a", "128k", output];
};
