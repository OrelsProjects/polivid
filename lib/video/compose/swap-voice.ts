import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { changeVoice, meanVolumeDb, mixVocal, separateVocal } from "@/lib/music/sing-as";
import { probeFile } from "@/lib/production/review/ffmpeg";

const execFileAsync = promisify(execFile);

/** A vocal stem quieter than this has no speech worth re-voicing, so the video keeps its sound. */
export const MIN_SPEECH_DB = -45;

const ffmpeg = (args: string[]) =>
  execFileAsync("ffmpeg", ["-loglevel", "error", "-y", ...args], { timeout: 3 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });

/** The ElevenLabs steps, swappable in tests so they run without spending anything. */
export interface RevoiceSteps {
  separateVocal: typeof separateVocal;
  changeVoice: typeof changeVoice;
}

const LIVE_STEPS: RevoiceSteps = { separateVocal, changeVoice };

/**
 * The swapped video with its speech re-voiced in `voiceId`. The voice is split from the rest of the sound,
 * changed with speech-to-speech so the words and timing stay, matched in loudness, and mixed back over
 * the background. Returns null when the video has no sound or no speech, so the caller keeps it as it is.
 */
export const revoiceVideo = async (video: Uint8Array, voiceId: string, steps: RevoiceSteps = LIVE_STEPS) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-revoice-"));
  try {
    const source = path.join(dir, "swap.mp4");
    await writeFile(source, video);
    const probe = await probeFile(source);
    if (!probe.hasAudio) return null;

    const sound = path.join(dir, "sound.mp3");
    await ffmpeg(["-i", source, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", sound]);
    const stems = await steps.separateVocal(new Uint8Array(await readFile(sound)));
    const original = await meanVolumeDb(stems.vocal);
    if (original === null || original < MIN_SPEECH_DB) return null;

    const voiced = await steps.changeVoice(stems.vocal, voiceId);
    const changed = await meanVolumeDb(voiced);
    const gain = changed === null ? 0 : Math.max(-24, Math.min(12, original - changed));
    const mix = path.join(dir, "mix.mp3");
    await writeFile(mix, await mixVocal(voiced, stems.backing, gain));

    // The picture is copied untouched. The new sound is padded with silence so it never ends early.
    const output = path.join(dir, "voiced.mp4");
    await ffmpeg([
      "-i", source, "-i", mix,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-af", "apad", "-c:a", "aac", "-b:a", "192k",
      "-shortest", "-movflags", "+faststart",
      output,
    ]);
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
