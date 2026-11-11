import "server-only";
import { writeVoiceover } from "@/lib/ai/voiceover";
import { db } from "@/lib/db";
import { renderEditProject } from "@/lib/editor/render";
import { generateImage } from "@/lib/images/generate";
import { isImageKey, isOwnedUploadKey } from "@/lib/storage/upload-key";
import { saveVideoForJob } from "@/lib/videos";
import { speakTimedBeats } from "@/lib/voice/speak";
import { FootageStopped, voiceMediaKey } from "../footage";
import { markVideoJobProgress, transitionVideoJob } from "../jobs";
import { putVideoMedia, readVideoMedia } from "../media-store";
import { resolveJobPreset } from "../mode-prepare";
import { NO_ON_SCREEN_TEXT } from "../on-screen-text";
import { withVisualStyle } from "../presets";
import type { ScenePlan } from "../schema";
import { spokenScript, stillBeatsForScript } from "../script-markup";
import { countWords, splitScript, stillCountFor, stillsUseDraft } from "../stills";
import { isStillRunning, readyRecord, titleFromPrompt, type JobInput } from "../worker-support";
import { describeStills } from "./plan-stills";
import { withRenderSlot } from "./render-slot";
import { buildStillsTimeline } from "./timeline";

/** Pictures drawn at once. The first is drawn alone, because the rest match their look to it. */
const PICTURE_CONCURRENCY = 3;

const IMAGES_FROM = 40;
const IMAGES_TO = 84;
const RENDER_FROM = 86;
const RENDER_TO = 98;

export interface StillsProgress {
  script: string;
  says: string[];
  shows: string[];
  /** Speech length of each beat. Empty until the voice is stored. */
  seconds: number[];
  /** Silence after each beat: what the script asked for, then what the voice track holds. */
  pauses: number[];
  /** Upload key per beat. An empty string means that picture is not drawn yet. */
  imageKeys: string[];
}

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** What an earlier run already finished, so a restart does not write, speak, or draw it again. */
export const readStillsProgress = (artifacts: unknown): StillsProgress => {
  const empty = { script: "", says: [], shows: [], seconds: [], pauses: [], imageKeys: [] };
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return empty;
  const saved = (artifacts as Record<string, unknown>).stills;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return empty;
  const record = saved as Record<string, unknown>;
  const says = strings(record.says).filter((say) => say.trim().length > 0);
  const shows = strings(record.shows);
  const seconds = Array.isArray(record.seconds)
    ? record.seconds.filter((value): value is number => typeof value === "number" && value > 0)
    : [];
  const imageKeys = strings(record.imageKeys);
  const pauses = Array.isArray(record.pauses) ? record.pauses : [];
  return {
    script: typeof record.script === "string" ? record.script : "",
    says,
    shows: shows.length === says.length ? shows : [],
    seconds: seconds.length === says.length ? seconds : [],
    pauses: says.map((_, index) => {
      const pause = pauses[index];
      return typeof pause === "number" && pause > 0 ? pause : 0;
    }),
    imageKeys: says.map((_, index) => imageKeys[index] ?? ""),
  };
};

export const rememberNarration = async (jobId: string, progress: StillsProgress) => {
  const job = await db.videoJob.findUnique({ where: { id: jobId }, select: { artifacts: true } });
  const current =
    job?.artifacts && typeof job.artifacts === "object" && !Array.isArray(job.artifacts)
      ? (job.artifacts as Record<string, unknown>)
      : {};
  await db.videoJob.update({
    where: { id: jobId },
    // The saved script keeps its notes and pauses. What was read aloud is the words alone.
    data: { artifacts: { ...current, stills: { ...progress }, spoken: progress.says.join(" ") || progress.script } },
  });
};

/** Scene lengths in a saved plan are kept between 2 and 12 seconds. */
export const sceneSeconds = (seconds: number) => Math.min(12, Math.max(2, Number(seconds.toFixed(2))));

/**
 * Makes an animated-stills video: writes or keeps the script, has the voice read it,
 * draws one picture per beat, and renders them together with captions.
 * The voice sets every length, so nothing spoken is cut off.
 */
export const composeStills = async (userId: string, jobId: string, input: JobInput) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId }, select: { artifacts: true } });
  const progress = readStillsProgress(job?.artifacts);

  // Notes and pauses are directions, so they stay out of the topic and the title.
  const spokenTopic = input.verbatim ? spokenScript(input.prompt) : input.prompt;
  if (!progress.script) {
    if (!(await markVideoJobProgress(jobId, "script", 10))) return;
    progress.script = input.verbatim ? input.prompt.trim() : await writeVoiceover(input.prompt, input.length);
  }
  // A script read word for word can say where each picture starts, what it shows, and where to pause.
  const marked = input.verbatim ? stillBeatsForScript(progress.script, input.length) : null;
  if (progress.says.length === 0) {
    progress.says = marked
      ? marked.map((beat) => beat.say)
      : splitScript(progress.script, stillCountFor(input.length, countWords(progress.script)));
    progress.pauses = progress.says.map((_, index) => marked?.[index]?.pause ?? 0);
    progress.shows = [];
    progress.seconds = [];
    progress.imageKeys = progress.says.map(() => "");
  }
  if (progress.says.length === 0) throw new Error("There is nothing to say. Write a script first.");
  if (progress.shows.length !== progress.says.length) {
    const notes = marked?.length === progress.says.length ? marked.map((beat) => beat.show) : [];
    progress.shows = await describeStills({ topic: spokenTopic, says: progress.says, notes });
  }
  await rememberNarration(jobId, progress);
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();

  // Voice first: it is cheap, and it decides how long each picture stays up.
  if (!(await markVideoJobProgress(jobId, "images", IMAGES_FROM))) return;
  const voiceKey = voiceMediaKey(jobId);
  if (progress.seconds.length !== progress.says.length || !(await readVideoMedia(voiceKey))) {
    const speech = await speakTimedBeats(userId, input.characterId, progress.says, undefined, progress.pauses);
    if (!speech) throw new Error("Pick a voice to read the script.");
    await putVideoMedia(voiceKey, speech.audio, "audio/mpeg");
    progress.seconds = speech.seconds;
    progress.pauses = speech.pauses;
    await rememberNarration(jobId, progress);
  }

  const preset = await resolveJobPreset({
    userId,
    prompt: input.prompt,
    mode: input.mode,
    engine: "footage",
    presetId: input.presetId,
    visualDirection: input.visualDirection,
  });
  const draft = stillsUseDraft(input.tier);
  const total = progress.says.length;
  const drawn = () => progress.imageKeys.filter(Boolean).length;
  const draw = async (index: number) => {
    const existing = progress.imageKeys[index];
    if (existing && isOwnedUploadKey(userId, existing) && isImageKey(existing)) return;
    const lead = index > 0 ? progress.imageKeys[0] : "";
    const picture = await generateImage(userId, {
      prompt: `${withVisualStyle(progress.shows[index] ?? progress.says[index] ?? "", preset, input.visualDirection)}\n\n${NO_ON_SCREEN_TEXT}`,
      format: input.format,
      draft,
      referenceKeys: lead ? [lead] : undefined,
    });
    progress.imageKeys[index] = picture.imageKey;
    await rememberNarration(jobId, progress);
    const pct = Math.round(IMAGES_FROM + ((IMAGES_TO - IMAGES_FROM) * drawn()) / total);
    if (!(await markVideoJobProgress(jobId, "images", pct))) throw new FootageStopped();
  };
  await draw(0);
  for (let start = 1; start < total; start += PICTURE_CONCURRENCY) {
    const batch = Array.from({ length: Math.min(PICTURE_CONCURRENCY, total - start) }, (_, offset) => start + offset);
    await Promise.all(batch.map(draw));
  }

  const beats = progress.says.map((say, index) => ({
    say,
    imageKey: progress.imageKeys[index] ?? "",
    seconds: progress.seconds[index] ?? 0,
    pause: progress.pauses[index] ?? 0,
  }));
  if (beats.some((beat) => !beat.imageKey || beat.seconds <= 0)) throw new Error("A picture is missing. Try again.");
  const timeline = buildStillsTimeline({
    jobId,
    format: input.format,
    beats,
    captions: input.showText !== false,
  });
  if (!(await markVideoJobProgress(jobId, "render", RENDER_FROM))) return;
  await withRenderSlot(() => renderEditProject(userId, jobId, timeline, { from: RENDER_FROM, to: RENDER_TO }));
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();

  const length = Math.max(2, Math.round(beats.reduce((sum, beat) => sum + beat.seconds + beat.pause, 0)));
  const title = titleFromPrompt(spokenTopic);
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
