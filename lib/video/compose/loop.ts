import "server-only";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeVoiceover } from "@/lib/ai/voiceover";
import { db } from "@/lib/db";
import { renderEditProject } from "@/lib/editor/render";
import type { AssetSource } from "@/lib/editor/schema";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { getUpload } from "@/lib/storage/s3";
import { isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import { saveVideoForJob } from "@/lib/videos";
import { speakTimedBeats } from "@/lib/voice/speak";
import { backgroundById, DEFAULT_BACKGROUND_ID } from "../backgrounds";
import { FootageStopped, voiceMediaKey } from "../footage";
import { markVideoJobProgress, transitionVideoJob } from "../jobs";
import { putVideoMedia, readVideoMedia } from "../media-store";
import type { ScenePlan } from "../schema";
import { loopBeatsForScript, spokenScript } from "../script-markup";
import { countWords, loopBeatCount, splitScript } from "../stills";
import { isStillRunning, readyRecord, titleFromPrompt, type JobInput } from "../worker-support";
import { withRenderSlot } from "./render-slot";
import { readStillsProgress, rememberNarration, sceneSeconds } from "./stills";
import { buildLoopTimeline } from "./timeline";

const VOICE_FROM = 12;
const VOICE_TO = 38;
const RENDER_FROM = 40;
const RENDER_TO = 98;

interface LoopBackground {
  source: AssetSource;
  seconds: number;
  name: string;
}

/** The clip behind the words: the person's own upload when they chose one, otherwise a built-in loop. */
const resolveBackground = async (userId: string, input: JobInput): Promise<LoopBackground> => {
  const key = input.backgroundKey;
  if (key) {
    if (!isOwnedUploadKey(userId, key) || !isVideoKey(key)) throw new Error("That background clip isn't in your library.");
    const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-loop-"));
    try {
      const file = path.join(dir, path.basename(key));
      await writeFile(file, (await getUpload(key)).bytes);
      const probe = await probeFile(file);
      if (!probe.hasVideo || !(probe.durationSec > 0.5)) throw new Error("That background clip can't be played.");
      return { source: { type: "upload", key }, seconds: probe.durationSec, name: "Your clip" };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  const loop = backgroundById(input.backgroundId) ?? backgroundById(DEFAULT_BACKGROUND_ID);
  if (!loop) throw new Error("Pick a background.");
  return { source: { type: "library", id: loop.id }, seconds: loop.seconds, name: loop.name };
};

/**
 * Makes a narrated video over a looping background: the voice reads the text, the clip
 * repeats underneath for as long as the voice runs, and captions follow the words.
 */
export const composeLoop = async (userId: string, jobId: string, input: JobInput) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId }, select: { artifacts: true } });
  const progress = readStillsProgress(job?.artifacts);

  if (!progress.script) {
    if (!(await markVideoJobProgress(jobId, "script", 10))) return;
    progress.script = input.verbatim ? input.prompt.trim() : await writeVoiceover(input.prompt, input.length);
  }
  if (progress.says.length === 0) {
    // A script read word for word may carry notes, which are not read, and pauses, which are held.
    const marked = input.verbatim ? loopBeatsForScript(progress.script) : null;
    progress.says = marked
      ? marked.map((beat) => beat.say)
      : splitScript(progress.script, loopBeatCount(countWords(progress.script)));
    progress.pauses = progress.says.map((_, index) => marked?.[index]?.pause ?? 0);
    progress.seconds = [];
  }
  if (progress.says.length === 0) throw new Error("There is nothing to say. Write the text first.");
  progress.shows = [];
  progress.imageKeys = [];
  await rememberNarration(jobId, progress);

  const background = await resolveBackground(userId, input);

  const voiceKey = voiceMediaKey(jobId);
  if (progress.seconds.length !== progress.says.length || !(await readVideoMedia(voiceKey))) {
    const speech = await speakTimedBeats(userId, input.characterId, progress.says, async (done, total) => {
      const pct = Math.round(VOICE_FROM + ((VOICE_TO - VOICE_FROM) * done) / total);
      if (!(await markVideoJobProgress(jobId, "script", pct))) throw new FootageStopped();
    }, progress.pauses);
    if (!speech) throw new Error("Pick a voice to read the text.");
    await putVideoMedia(voiceKey, speech.audio, "audio/mpeg");
    progress.seconds = speech.seconds;
    progress.pauses = speech.pauses;
    await rememberNarration(jobId, progress);
  }

  const beats = progress.says.map((say, index) => ({
    say,
    seconds: progress.seconds[index] ?? 0,
    pause: progress.pauses[index] ?? 0,
  }));
  if (beats.some((beat) => beat.seconds <= 0)) throw new Error("The voice didn't come back. Try again.");
  const timeline = buildLoopTimeline({
    jobId,
    format: input.format,
    beats,
    captions: input.showText !== false,
    background,
  });
  if (!(await markVideoJobProgress(jobId, "render", RENDER_FROM))) return;
  await withRenderSlot(() => renderEditProject(userId, jobId, timeline, { from: RENDER_FROM, to: RENDER_TO }));
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();

  const length = Math.max(2, Math.round(beats.reduce((sum, beat) => sum + beat.seconds + beat.pause, 0)));
  const title = titleFromPrompt(input.verbatim ? spokenScript(input.prompt) : input.prompt);
  const plan: ScenePlan = {
    title,
    scenes: beats.map((beat) => ({
      type: "footage",
      headline: title,
      narration: beat.say,
      factIds: [],
      quote: null,
      durationSec: sceneSeconds(beat.seconds + beat.pause),
    })),
  };
  await saveVideoForJob(userId, readyRecord(jobId, input, plan, length, false));
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: `/api/videos/${jobId}/file`, error: null });
};
