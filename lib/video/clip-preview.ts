import { readStoredSong } from "@/lib/music/song";
import { MAX_CUTS } from "@/lib/music/song-plan";
import { readStitchPlan } from "./segments";

/** One shot the progress page can play while the rest are still filming. */
export interface ClipPreviewSlot {
  index: number;
  /** Seconds from the start of the video. */
  startSec: number;
  /** Seconds this shot stays on screen. The stored file may be longer. */
  durationSec: number;
  ready: boolean;
}

/**
 * Names every shot in a multi-clip video. A stored song wins, then a stitch plan,
 * then lyrics cuts. One-clip videos return nothing: there is no separate shot file yet.
 */
export const clipPreviewSlots = (
  artifacts: unknown,
  input: { mode: string; cuts: readonly { seconds: number }[] },
  ready: ReadonlySet<number>,
): ClipPreviewSlot[] => {
  const song = readStoredSong(artifacts);
  const slots: ClipPreviewSlot[] = song
    ? song.shots.map((shot) => ({
        index: shot.index,
        startSec: shot.startSec,
        durationSec: shot.durationSec,
        ready: ready.has(shot.index),
      }))
    : [];

  if (slots.length === 0) {
    const plan = readStitchPlan(artifacts);
    if (plan) {
      let startSec = 0;
      for (const [index, durationSec] of plan.segments.entries()) {
        slots.push({ index, startSec, durationSec, ready: ready.has(index) });
        startSec += durationSec;
      }
    }
  }

  if (slots.length === 0 && (input.mode === "lyrics" || input.mode === "prompt")) {
    let startSec = 0;
    input.cuts.forEach((cut, index) => {
      slots.push({ index, startSec, durationSec: cut.seconds, ready: ready.has(index) });
      startSec += cut.seconds;
    });
  }

  slots.sort((a, b) => a.index - b.index);
  return slots.length > 1 ? slots : [];
};

/** Shot index from a route param. Rejects anything that is not 0 .. MAX_CUTS-1. */
export const clipIndexFromParam = (value: string): number | null => {
  if (!/^\d{1,2}$/.test(value)) return null;
  const index = Number(value);
  if (index >= MAX_CUTS) return null;
  return index;
};
