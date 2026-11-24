import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { spokenWordsForVideo } from "@/lib/editor/caption-speech";
import { getCharacter } from "@/lib/characters/store";
import { db } from "@/lib/db";
import { createProjectFromTimelineForUser } from "@/lib/editor/projects";
import { renderEditProject } from "@/lib/editor/render";
import type { Focus } from "@/lib/editor/schema";
import { generateImage } from "@/lib/images/generate";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { isImageKey, isOwnedUploadKey } from "@/lib/storage/upload-key";
import { saveVideoForJob } from "@/lib/videos";
import type { TimedWord } from "../captions";
import { FootageStopped, footageKey } from "../footage";
import { readJobInput } from "../job-status";
import { markVideoJobProgress, transitionVideoJob } from "../jobs";
import { readVideoMedia } from "../media-store";
import { NO_ON_SCREEN_TEXT } from "../on-screen-text";
import type { ScenePlan, VideoFormat } from "../schema";
import { isStillRunning, readyRecord, titleFromPrompt, type JobInput } from "../worker-support";
import { withRenderSlot } from "../compose/render-slot";
import { beatsFromWords, type LayoutBeat } from "./beats";
import { findFace, suggestLayoutPlan } from "./plan";
import { enforcePlan, type BeatPlan } from "./rules";
import { layoutStyleById, type LayoutJobSettings } from "./styles";
import { buildLayoutTimeline, type BeatMedia } from "./timeline";

const execFileAsync = promisify(execFile);

const PICTURE_CONCURRENCY = 3;
const IMAGES_FROM = 30;
const IMAGES_TO = 84;
const RENDER_FROM = 86;
const RENDER_TO = 98;

/** What an earlier run of this job already finished. */
interface LayoutProgress {
  words: TimedWord[];
  seconds: number;
  face: Focus | null;
  plans: BeatPlan[];
  /** Upload key of the picture drawn for each beat. Empty when none was drawn. */
  drawn: string[];
}

const readProgress = (artifacts: unknown): LayoutProgress => {
  const empty: LayoutProgress = { words: [], seconds: 0, face: null, plans: [], drawn: [] };
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return empty;
  const saved = (artifacts as Record<string, unknown>).layout;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return empty;
  const record = saved as Partial<LayoutProgress>;
  return {
    words: Array.isArray(record.words) ? record.words : [],
    seconds: typeof record.seconds === "number" ? record.seconds : 0,
    face: record.face && typeof record.face === "object" ? record.face : null,
    plans: Array.isArray(record.plans) ? record.plans : [],
    drawn: Array.isArray(record.drawn) ? record.drawn.map((key) => (typeof key === "string" ? key : "")) : [],
  };
};

const remember = async (jobId: string, progress: LayoutProgress) => {
  const job = await db.videoJob.findUnique({ where: { id: jobId }, select: { artifacts: true } });
  const current =
    job?.artifacts && typeof job.artifacts === "object" && !Array.isArray(job.artifacts)
      ? (job.artifacts as Record<string, unknown>)
      : {};
  await db.videoJob.update({
    where: { id: jobId },
    data: { artifacts: { ...current, layout: JSON.parse(JSON.stringify(progress)) } },
  });
};

/** One still from the take, and its length. */
const readTake = async (videoId: string) => {
  const bytes = await readVideoMedia(footageKey(videoId));
  if (!bytes) throw new Error("That video has no file to lay out.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-layout-"));
  try {
    const source = path.join(dir, "take.mp4");
    await writeFile(source, bytes);
    const probe = await probeFile(source);
    if (!probe.hasAudio) throw new Error("That video has no voice to lay out.");
    const still = path.join(dir, "frame.jpg");
    await execFileAsync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(Math.min(1, probe.durationSec / 2)), "-i", source, "-frames:v", "1", "-q:v", "3", still]);
    return { seconds: probe.durationSec, frame: new Uint8Array(await readFile(still)) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** Without word timing, the script's words are spread evenly over the take. Cuts land near, not on, the words. */
const evenWords = (script: string, seconds: number): TimedWord[] => {
  const words = script.split(/\s+/).filter(Boolean);
  const each = seconds / Math.max(1, words.length);
  return words.map((text, index) => ({ text, start: index * each, end: (index + 0.9) * each }));
};

const scenesFor = (title: string, beats: readonly LayoutBeat[]): ScenePlan["scenes"] => {
  const scenes: ScenePlan["scenes"] = [];
  let narration: string[] = [];
  let start = 0;
  for (const [index, beat] of beats.entries()) {
    narration.push(beat.say);
    const last = index === beats.length - 1;
    if (beat.end - start >= 8 || last) {
      scenes.push({
        type: "footage",
        headline: title,
        narration: narration.join(" "),
        factIds: [],
        quote: null,
        durationSec: Math.min(12, Math.max(2, Number((beat.end - start).toFixed(2)))),
      });
      narration = [];
      start = beat.end;
    }
  }
  return scenes;
};

/**
 * Lays out a finished avatar video in a layout style. Its own take is the picture and the voice,
 * so lips stay on the words, and nothing is filmed again: the words are timed from the take,
 * cut into beats, given layouts that follow the style's rules, pictures are drawn only for
 * beats that show one and have no upload, and the result is rendered and opened as an edit.
 */
export const composeLayout = async (userId: string, jobId: string, input: JobInput) => {
  const settings: LayoutJobSettings | undefined = input.layout;
  const style = layoutStyleById(settings?.style);
  if (!settings || !style) throw new Error("This layout job is missing its style.");
  if (!style.avatar) throw new Error(`${style.title} isn't ready yet.`);
  const sourceId = settings.sourceVideoId;
  const [source, sourceJob, job] = await Promise.all([
    db.video.findFirst({ where: { id: sourceId, userId }, select: { id: true, title: true, format: true } }),
    db.videoJob.findFirst({ where: { id: sourceId, userId }, select: { input: true, artifacts: true } }),
    db.videoJob.findFirst({ where: { id: jobId, userId }, select: { artifacts: true } }),
  ]);
  if (!source) throw new Error("That video isn't in your library anymore.");
  const format = input.format as VideoFormat;
  const sourceInput = sourceJob ? readJobInput(sourceJob.input) : null;
  const sourceArtifacts =
    sourceJob?.artifacts && typeof sourceJob.artifacts === "object" && !Array.isArray(sourceJob.artifacts)
      ? (sourceJob.artifacts as Record<string, unknown>)
      : {};
  const script = (typeof sourceArtifacts.spoken === "string" && sourceArtifacts.spoken.trim()) || sourceInput?.prompt || input.prompt;
  const media = settings.media.filter((item) => isOwnedUploadKey(userId, item.key));
  const progress = readProgress(job?.artifacts);

  if (progress.words.length === 0 || !progress.face) {
    if (!(await markVideoJobProgress(jobId, "script", 8))) return;
    const take = await readTake(sourceId);
    // The take's words are timed once per video and saved, so captions added in the editor later reuse them.
    let words: TimedWord[] = [];
    try {
      words = await spokenWordsForVideo(userId, sourceId);
    } catch (error) {
      console.error("Could not time the words in the take. Spreading the script evenly.", error);
    }
    progress.words = words.length > 0 ? words : evenWords(script, take.seconds);
    progress.seconds = take.seconds;
    progress.face = await findFace(take.frame);
    await remember(jobId, progress);
  }
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();

  const beats = beatsFromWords(progress.words, {
    ...style.beatSeconds,
    total: progress.seconds,
    sentences: style.id === "punch-in",
  });
  if (beats.length === 0) throw new Error("No speech was found in that video.");
  if (progress.plans.length !== beats.length) {
    if (!(await markVideoJobProgress(jobId, "script", 20))) return;
    const suggested = await suggestLayoutPlan({ style, beats, media, topic: script });
    progress.plans = enforcePlan({ style, beats, suggested, media, script });
    progress.drawn = beats.map(() => "");
    await remember(jobId, progress);
  }

  // Pictures are drawn only for beats that show one and have no upload. The first sets the look.
  if (!(await markVideoJobProgress(jobId, "images", IMAGES_FROM))) return;
  const toDraw = progress.plans.flatMap((plan, index) => (plan.picture && plan.upload === undefined ? [index] : []));
  const draw = async (index: number) => {
    const existing = progress.drawn[index];
    if (existing && isOwnedUploadKey(userId, existing) && isImageKey(existing)) return;
    const plan = progress.plans[index];
    const lead = progress.drawn[toDraw[0]] && index !== toDraw[0] ? progress.drawn[toDraw[0]] : "";
    const picture = await generateImage(userId, {
      prompt: `${plan.picture}\n\n${NO_ON_SCREEN_TEXT}`,
      // A split shows the picture in half the frame, so it is drawn square and cropped a little.
      format: plan.layout === "split" ? "1:1" : format,
      referenceKeys: lead ? [lead] : undefined,
    });
    progress.drawn[index] = picture.imageKey;
    await remember(jobId, progress);
    const done = toDraw.filter((item) => progress.drawn[item]).length;
    if (!(await markVideoJobProgress(jobId, "images", Math.round(IMAGES_FROM + ((IMAGES_TO - IMAGES_FROM) * done) / Math.max(1, toDraw.length))))) {
      throw new FootageStopped();
    }
  };
  if (toDraw.length > 0) {
    await draw(toDraw[0]);
    for (let start = 1; start < toDraw.length; start += PICTURE_CONCURRENCY) {
      await Promise.all(toDraw.slice(start, start + PICTURE_CONCURRENCY).map(draw));
    }
  }

  const beatMedia: (BeatMedia | null)[] = progress.plans.map((plan, index) => {
    if (plan.upload !== undefined && media[plan.upload]) return { key: media[plan.upload].key, kind: media[plan.upload].kind };
    if (progress.drawn[index]) return { key: progress.drawn[index], kind: "image" };
    return null;
  });
  const characterName =
    sourceInput?.characterId ? ((await getCharacter(userId, sourceInput.characterId).catch(() => null))?.name ?? "") : "";
  const timeline = buildLayoutTimeline({
    format,
    style,
    take: { videoId: sourceId, seconds: progress.seconds, focus: progress.face ?? { x: 50, y: 35 } },
    beats,
    plans: progress.plans,
    media: beatMedia,
    captions: input.showText !== false,
    header: { name: characterName, headline: source.title },
  });

  if (!(await markVideoJobProgress(jobId, "render", RENDER_FROM))) return;
  await withRenderSlot(() => renderEditProject(userId, jobId, timeline, { from: RENDER_FROM, to: RENDER_TO }));
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();

  const title = source.title || titleFromPrompt(script);
  const length = Math.max(2, Math.round(progress.seconds));
  await saveVideoForJob(userId, {
    ...readyRecord(jobId, input, { title, scenes: scenesFor(title, beats) }, length, false),
    parentVideoId: sourceId,
  });
  // The layers open in the editor, so a beat's layout can still be changed after the render.
  const project = await createProjectFromTimelineForUser(userId, { title, format, timeline, sourceVideoId: jobId });
  await saveVideoForJob(userId, {
    ...readyRecord(jobId, input, { title, scenes: scenesFor(title, beats) }, length, false),
    parentVideoId: sourceId,
    editProjectId: project.id,
  });
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: `/api/videos/${jobId}/file`, error: null });
};
