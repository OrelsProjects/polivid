import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { db } from "@/lib/db";
import { getProjectForUser } from "@/lib/editor/projects";
import { renderEditProject } from "@/lib/editor/render";
import { timelineDurationInFrames } from "@/lib/editor/schema";
import { createVideo, saveReadyVideo } from "@/lib/videos";
import { composeSong } from "@/lib/music/compose";
import { signedGetUrl } from "@/lib/storage/s3";
import { isImageKey } from "@/lib/storage/upload-key";
import { songMediaKey, songSliceKey, readStoredSong, type StoredSong } from "@/lib/music/song";
import { extractSongBrief } from "@/lib/music/song-brief";
import { planShots, planSongSections, splitLyricSections, type SongShot } from "@/lib/music/song-plan";
import { readSongDraft, readSongDraftAudio } from "@/lib/music/song-draft";
import { singAs } from "@/lib/music/sing-as";
import { mixNarration, narrationAudio, resolveCharacterVoice } from "@/lib/voice/speak";
import { clipFinishData, clipStartData } from "./clip-timing";
import { DEMO_FACTS, DEMO_PLAN, DEMO_QUOTES } from "./demo";
import { finishFootage, footageErrorMessage, FootageStopped, renderFootage, saveFootage, type FootageRequest } from "./footage";
import { progressFor, readJobInput } from "./job-status";
import { markVideoJobProgress, transitionVideoJob } from "./jobs";
import { deleteVideoMedia, putVideoMedia, readVideoMedia, signedVideoMediaUrl } from "./media-store";
import { footageFromPrepared, prepareModeJob, referenceImageDataUrl, resolveJobPreset, type PreparedJob } from "./mode-prepare";
import { NO_ON_SCREEN_TEXT } from "./on-screen-text";
import { clipDuration, clipResolution, generationModelBySlug, isVideoProvider, type VideoProvider } from "./models";
import { lyricsClipDurations, singerModelsFor } from "./singer-models";
import { modeNeedsUpload, videoModeById } from "./modes";
import { buildScenePlan, normalizePlan, runResearch, writeScript } from "./pipeline";
import { FPS, VIDEO_FORMATS, type ScenePlan, type VideoFormat, type VideoRecord } from "./schema";
import { shouldHoldAfterClip } from "./job-stages";
import { AUTO_PRESET_ID, withVisualStyle } from "./presets";
import { isStitchedMode, planSegments, readStitchPlan, segmentMediaKey } from "./segments";
import { assembleSongVideo, lastFrameDataUrl, sliceSong, stitchClips } from "./stitch";
import { writeBeats } from "./beats";

/** One under the images band, so skipped script and image steps stay unchecked. */
const FILMING_PROGRESS = progressFor("images") - 1;

interface JobInput {
  prompt: string;
  format: VideoFormat;
  length: number;
  model: string;
  mode?: string;
  tier?: string;
  resolution?: string;
  mediaKey?: string;
  referenceKeys?: string[];
  showText?: boolean;
  projectId?: string;
  presetId?: string;
  visualDirection?: string;
  characterId?: string;
  songId?: string;
}

/** One promise per video, so several can film at once. Kept here so a finished request does not drop a long render. */
const runs = new Map<string, Promise<void>>();

const track = (jobId: string, run: Promise<void>) => {
  const existing = runs.get(jobId);
  if (existing) return existing;
  const wrapped = run.finally(() => {
    if (runs.get(jobId) === wrapped) runs.delete(jobId);
  });
  runs.set(jobId, wrapped);
  return wrapped;
};

/** Starts this video now. A video this process is already filming is left alone. */
export const startVideoJob = (userId: string, jobId: string) => {
  const existing = runs.get(jobId);
  if (existing) return existing;
  return track(jobId, filmQueuedJob(userId, jobId));
};

/**
 * Starts every open video this process is not already filming.
 * A video OpenRouter already accepted is polled. One that never left is submitted.
 */
export const resumeOpenVideos = async (userId: string) => {
  const jobs = await db.videoJob.findMany({
    where: { userId, status: { in: ["queued", "running"] } },
    include: { providerJobs: { orderBy: { createdAt: "desc" } } },
  });
  for (const job of jobs) {
    if (runs.has(job.id)) continue;
    const provider = job.providerJobs.find((row) => row.status === "in_progress" || row.status === "pending");
    if (job.status === "running" && provider) {
      if (resumesAsSegments(job)) {
        track(job.id, filmRunningJob(userId, job.id));
        continue;
      }
      track(job.id, finishKnownFootage(userId, job.id, provider.providerJobId, provider.provider));
      continue;
    }
    if (job.status === "running") {
      track(job.id, filmRunningJob(userId, job.id));
      continue;
    }
    track(job.id, filmQueuedJob(userId, job.id));
  }
};

const filmQueuedJob = async (userId: string, jobId: string) => {
  try {
    await transitionVideoJob(jobId, "running");
  } catch {
    return;
  }

  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "running") return;
  const input = readJobInput(job.input);

  try {
    if (!isFormat(input.format) || !input.model || input.length < 2) {
      throw new Error("This queued video is missing a model, format, or length.");
    }
    const mode = input.mode ? videoModeById(input.mode) : null;
    if (mode && modeNeedsUpload(mode) && !input.mediaKey) {
      throw new Error("Upload a file for this mode.");
    }

    if (input.mode === "editor-export") {
      await filmEditorExport(userId, jobId, toJobInput(input));
    } else if (!hasOpenRouterKey()) {
      await filmDemo(userId, jobId, toJobInput(input));
    } else if (input.mode === "motion-graphics") {
      await filmMotion(userId, jobId, toJobInput(input));
    } else {
      await filmWithModel(userId, jobId, toJobInput(input));
    }
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (leaveRunningOnSilence(jobId, error)) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = footageErrorMessage(error);
    await failOpenClips(jobId, input.model);
    await saveFailedVideo(userId, jobId, input, message);
    await transitionVideoJob(jobId, "failed", { error: message });
  }
};

const filmRunningJob = async (userId: string, jobId: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "running") return;
  const input = readJobInput(job.input);
  if (!isFormat(input.format) || !input.model || input.length < 2) return;
  try {
    if (input.mode === "editor-export") {
      await filmEditorExport(userId, jobId, toJobInput(input));
      return;
    }
    if (!hasOpenRouterKey()) {
      await filmDemo(userId, jobId, toJobInput(input));
      return;
    }
    if (input.mode === "motion-graphics") {
      await filmMotion(userId, jobId, toJobInput(input));
      return;
    }
    await filmWithModel(userId, jobId, toJobInput(input));
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (leaveRunningOnSilence(jobId, error)) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = footageErrorMessage(error);
    await failOpenClips(jobId, input.model);
    await saveFailedVideo(userId, jobId, input, message);
    await transitionVideoJob(jobId, "failed", { error: message });
  }
};

const filmEditorExport = async (userId: string, jobId: string, input: JobInput) => {
  if (!input.projectId) throw new Error("This export is missing its edit.");
  const project = await getProjectForUser(userId, input.projectId);
  if (!project) throw new Error("That edit was not found.");
  if (!(await markVideoJobProgress(jobId, "render", 10))) return;
  await renderEditProject(userId, jobId, project.timeline);
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();
  const length = Math.max(2, Math.round(timelineDurationInFrames(project.timeline) / FPS));
  const plan = footagePlan(project.title, length, project.title);
  await createVideo(userId, {
    ...readyRecord(jobId, { ...input, length }, plan, length, false),
    title: project.title,
    parentVideoId: project.sourceVideoId,
    editProjectId: project.id,
  });
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", {
    outputUrl: `/api/videos/${jobId}/file`,
    error: null,
  });
};

const filmWithModel = async (userId: string, jobId: string, input: JobInput) => {
  const model = generationModelBySlug(input.model);
  if (!model) throw new Error("Pick a video model.");
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId }, select: { artifacts: true } });
  const saved = readStitchPlan(job?.artifacts);
  if (input.mode === "lyrics" && (readStoredSong(job?.artifacts) || !saved)) {
    await filmSongVideo(userId, jobId, input);
    return;
  }
  if (!saved && !(await markVideoJobProgress(jobId, "script", 10))) return;
  const stitch = isStitchedMode(input.mode);
  const segments =
    saved?.segments ?? (stitch ? planSegments(input.length, model.durations) : [clipDuration(input.length, model.durations)]);
  const prepared = await prepareModeJob(userId, {
    ...input,
    segments: stitch && segments.length > 1 ? segments : undefined,
    existingBeats: saved?.beats,
    existingSpoken: readSpoken(job?.artifacts),
  });
  if (prepared.spoken) await rememberSpoken(jobId, job?.artifacts, prepared.spoken);
  const speech = await narrationAudio(userId, input.characterId, prepared.spoken);
  if (prepared.reuseUploadAsFootage && prepared.mediaBytes) {
    await storeClip(userId, jobId, input, input.length, prepared.mediaBytes, prepared.transcript ?? prepared.prompt);
    return;
  }
  if (stitch && segments.length > 1) {
    await filmSegments(userId, jobId, input, prepared, segments, speech);
    return;
  }
  if (!(await markVideoJobProgress(jobId, "videos", FILMING_PROGRESS))) return;
  const clip = await renderFootage(
    footageFromPrepared(prepared),
    () => isStillRunning(userId, jobId),
    (providerJobId, provider) => rememberProviderJob(jobId, providerJobId, provider, 0, input.model),
  );
  await finishSceneClip(jobId, 0, "completed", input.model);
  const voiced = speech ? await mixNarration(clip.bytes, speech, clip.durationSec) : clip.bytes;
  await storeClip(userId, jobId, input, clip.durationSec, voiced, prepared.spoken?.trim() || prepared.prompt);
};

const filmMotion = async (userId: string, jobId: string, input: JobInput) => {
  if (!(await markVideoJobProgress(jobId, "script", 10))) return;
  const generateInput = {
    prompt: input.prompt,
    format: input.format,
    length: input.length,
    model: input.model,
  };
  if (input.tier === "ultra") {
    const { research, searchSources } = await runResearch(input.prompt, input.model);
    if (!(await markVideoJobProgress(jobId, "images", 40))) return;
    const { plan, lint } = await buildScenePlan(generateInput, research, searchSources);
    if (lint.errors[0]) throw new Error(lint.errors[0]);
    await createVideo(userId, {
      ...readyRecord(jobId, input, normalizePlan(plan, input.length), input.length, false),
      facts: research.facts,
      quotes: research.quotes,
      searchSources,
      unverifiedFactIds: lint.unverifiedFactIds,
    });
  } else {
    const plan = normalizePlan(await writeScript(generateInput), input.length);
    await createVideo(userId, readyRecord(jobId, input, plan, input.length, false));
  }
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: null, error: null });
};

const finishKnownFootage = async (userId: string, jobId: string, providerJobId: string, provider: string) => {
  const job = await db.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "running") return;
  const input = readJobInput(job.input);
  if (!isFormat(input.format) || !input.model) return;
  const model = generationModelBySlug(input.model);
  if (!model) return;
  try {
    if (readStitchPlan(job.artifacts)) {
      await filmWithModel(userId, jobId, toJobInput(input));
      return;
    }
    const bytes = await finishFootage(providerJobId, isVideoProvider(provider) ? provider : model.provider, () =>
      isStillRunning(userId, jobId),
    );
    await finishProviderClip(providerJobId, "completed", input.model);
    const jobInput = toJobInput(input);
    const spoken = readSpoken(job.artifacts);
    const durationSec = clipDuration(input.length, model.durations);
    const speech = await narrationAudio(userId, jobInput.characterId, spoken);
    const voiced = speech ? await mixNarration(bytes, speech, durationSec) : bytes;
    await storeClip(userId, jobId, jobInput, durationSec, voiced, spoken || undefined);
  } catch (error) {
    if (error instanceof FootageStopped) return;
    if (leaveRunningOnSilence(jobId, error)) return;
    if (!(await isStillRunning(userId, jobId))) return;
    const message = footageErrorMessage(error);
    await finishProviderClip(providerJobId, "failed", input.model);
    await saveFailedVideo(userId, jobId, input, message);
    await transitionVideoJob(jobId, "failed", { error: message });
  }
};

const storeClip = async (
  userId: string,
  jobId: string,
  input: JobInput,
  durationSec: number,
  bytes: Uint8Array,
  narration = input.prompt,
) => {
  if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();
  await saveFootage(jobId, bytes);
  const plan = footagePlan(input.prompt, durationSec, input.showText === false ? "" : narration);
  await saveReadyVideo(userId, readyRecord(jobId, input, plan, durationSec, false));
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", {
    outputUrl: `/api/videos/${jobId}/file`,
    error: null,
  });
};

const rememberProviderJob = async (
  jobId: string,
  providerJobId: string,
  provider: VideoProvider,
  sceneIdx = 0,
  model?: string,
) => {
  console.info("Waiting on the video model", { jobId, providerJobId, provider, sceneIdx, model });
  await db.providerJob.deleteMany({ where: { jobId, sceneIdx } });
  await db.providerJob.create({
    data: { providerJobId, provider, jobId, sceneIdx, ...clipStartData(model, new Date()) },
  });
};

const finishProviderClip = async (providerJobId: string, status: "completed" | "failed", model?: string) => {
  try {
    const existing = await db.providerJob.findUnique({ where: { providerJobId } });
    if (!existing) return;
    const data = clipFinishData(existing, status, model, new Date());
    if (!data) return;
    await db.providerJob.update({ where: { providerJobId }, data });
  } catch (error) {
    console.error("Could not record clip timing", { providerJobId, status, error });
  }
};

const finishSceneClip = async (jobId: string, sceneIdx: number, status: "completed" | "failed", model?: string) => {
  const row = await db.providerJob.findFirst({ where: { jobId, sceneIdx }, orderBy: { createdAt: "desc" } });
  if (!row) return;
  await finishProviderClip(row.providerJobId, status, model);
};

const failOpenClips = async (jobId: string, model?: string) => {
  const open = await db.providerJob.findMany({
    where: { jobId, finishedAt: null, status: { in: ["pending", "in_progress"] } },
  });
  await Promise.all(open.map((row) => finishProviderClip(row.providerJobId, "failed", model)));
};

const resumesAsSegments = (job: { artifacts: unknown; providerJobs: { sceneIdx: number }[] }) =>
  Boolean(readStitchPlan(job.artifacts) || job.providerJobs.some((row) => row.sceneIdx > 0));

const segmentKey = segmentMediaKey;

const stopRequested = async (jobId: string) => {
  try {
    const job = await db.videoJob.findFirst({
      where: { id: jobId },
      select: { stopAfterClip: true, status: true },
    });
    return job?.status === "running" && job.stopAfterClip;
  } catch (error) {
    console.error("Could not read the stop flag. Filming continues.", error);
    return false;
  }
};

/** Stitches the clips filmed so far into a watchable cut and waits. Segment files stay for resume. */
const readStoredClips = async (jobId: string, total: number) => {
  const clips: Uint8Array[] = [];
  for (let index = 0; index < total; index += 1) {
    const saved = await readVideoMedia(segmentKey(jobId, index));
    if (!saved) break;
    clips.push(saved);
  }
  return clips;
};

const publishPartial = async (
  userId: string,
  jobId: string,
  input: JobInput,
  segments: number[],
  beats: string[],
  speech: Uint8Array | null,
) => {
  if (!(await isStillRunning(userId, jobId))) return;
  const stored = await readStoredClips(jobId, segments.length);
  if (stored.length < 1) return;
  const filmed = segments.slice(0, stored.length);
  const duration = filmed.reduce((sum, part) => sum + part, 0);
  let bytes = await stitchClips(stored);
  if (speech) {
    try {
      bytes = await mixNarration(bytes, speech, duration);
    } catch (error) {
      console.error("Could not add narration to the partial video", error);
    }
  }
  await pauseWithCut(userId, jobId, input, bytes, duration, beats.slice(0, stored.length).join("\n\n"), stored.length, segments.length);
};

const pauseWithCut = async (
  userId: string,
  jobId: string,
  input: JobInput,
  bytes: Uint8Array,
  duration: number,
  narration: string,
  filmed: number,
  total: number,
) => {
  if (!(await isStillRunning(userId, jobId))) return;
  await saveFootage(jobId, bytes);
  await saveReadyVideo(
    userId,
    readyRecord(jobId, input, footagePlan(input.prompt, duration, input.showText === false ? "" : narration), duration, false),
  );
  try {
    await transitionVideoJob(jobId, "paused", { outputUrl: `/api/videos/${jobId}/file`, error: null });
  } catch (error) {
    console.error("Could not pause the video", error);
    await db.video.deleteMany({ where: { id: jobId, userId } }).catch(() => undefined);
    return;
  }
  await db.videoJob.update({
    where: { id: jobId },
    data: {
      stopAfterClip: false,
      currentStep: "videos",
      progressPct: progressFor("videos", filmed, Math.max(total, 1)),
    },
  });
};

const SONG_CONCURRENCY = 4;

const rememberSong = async (jobId: string, artifacts: unknown, song: StoredSong) => {
  const current =
    artifacts && typeof artifacts === "object" && !Array.isArray(artifacts) ? (artifacts as Record<string, unknown>) : {};
  await db.videoJob.update({
    where: { id: jobId },
    data: {
      artifacts: JSON.parse(
        JSON.stringify({
          ...current,
          song,
          segments: song.shots.map((shot) => shot.durationSec),
          beats: song.prompts,
          spoken: song.shots.flatMap((shot) => shot.lines).join("\n"),
        }),
      ),
    },
  });
};

const PERFORMER_IMAGE =
  "The reference image is the performer. Keep that exact face, hair, age, and clothes, and do not cast a different person.";
const PERFORMER_SINGS =
  "The reference audio is the song this person is singing. Lip-sync precisely to it from the first frame: every mouth shape matches the sung words, and the mouth closes when the vocal pauses. Keep the face clearly visible.";
const PERFORMER_LISTENS = "This person is not singing in this shot. Mouth closed or relaxed.";
const SCENE_ONLY = "Show the scene, the room, or the instruments. No close-up of a singing mouth.";

const songPrompt = (
  visual: string,
  shot: SongShot,
  preset: Awaited<ReturnType<typeof resolveJobPreset>>,
  direction: string | undefined,
  hasPerformer: boolean,
) => {
  const camera = hasPerformer
    ? `${PERFORMER_IMAGE}\n${shot.kind === "performance" ? PERFORMER_SINGS : PERFORMER_LISTENS}`
    : SCENE_ONLY;
  return `${camera}\n${withVisualStyle(visual, preset, direction)}\n\n${NO_ON_SCREEN_TEXT}`;
};

const filmSongShot = async (
  userId: string,
  jobId: string,
  input: JobInput,
  shot: SongShot,
  prompt: string,
  songBytes: Uint8Array,
) => {
  const key = segmentMediaKey(jobId, shot.index);
  if (await readVideoMedia(key)) return;
  const shouldContinue = () => isStillRunning(userId, jobId);
  const save = async (bytes: Uint8Array, model: string) => {
    await finishSceneClip(jobId, shot.index, "completed", model);
    await putVideoMedia(key, bytes, "video/mp4");
  };
  const imageKey = input.referenceKeys?.find((key) => isImageKey(key));
  let image: Record<string, unknown> | null = null;
  if (imageKey) {
    const hosted = await signedGetUrl(imageKey).catch(() => "");
    const imageUrl = hosted || (await referenceImageDataUrl(userId, [imageKey]));
    if (imageUrl) image = { type: "image_url", image_url: { url: imageUrl } };
  }
  let audio: Record<string, unknown> | null = null;
  if (image && shot.kind === "performance") {
    try {
      const slice = await sliceSong(songBytes, shot.startSec, shot.durationSec);
      const sliceKey = songSliceKey(jobId, shot.index);
      await putVideoMedia(sliceKey, slice, "audio/wav");
      const audioUrl = await signedVideoMediaUrl(sliceKey);
      if (audioUrl) audio = { type: "audio_url", audio_url: { url: audioUrl } };
    } catch (error) {
      if (error instanceof FootageStopped) throw error;
      console.error("Could not attach the song slice", { jobId, sceneIdx: shot.index, error });
    }
  }
  const film = async (slug: string, references: Record<string, unknown>[]) => {
    const model = generationModelBySlug(slug);
    const clip = await renderFootage(
      {
        prompt,
        format: input.format,
        length: shot.durationSec,
        model: slug,
        resolution:
          model && !model.resolutions.includes(input.resolution ?? "") ? clipResolution(model.resolutions) : input.resolution,
        generateAudio: false,
        inputReferences: references,
      },
      shouldContinue,
      (providerJobId, provider) => rememberProviderJob(jobId, providerJobId, provider, shot.index, slug),
    );
    await save(clip.bytes, slug);
  };
  if (image && audio) {
    for (const slug of singerModels(input.model)) {
      try {
        await film(slug, [image, audio]);
        return;
      } catch (error) {
        if (error instanceof FootageStopped) throw error;
        console.error("Singer clip could not use this model", { jobId, sceneIdx: shot.index, slug, error });
      }
    }
  }
  await film(input.model, image ? [image] : []);
};

const singerModels = (chosen: string) => singerModelsFor(chosen).map((model) => model.slug);

/** The approved take from the create page, or a new song sung by the character when it has a voice. */
const songForJob = async (userId: string, jobId: string, input: JobInput, hasSinger: boolean) => {
  if (input.songId) {
    const draft = await readSongDraft(userId, input.songId);
    const audio = draft ? await readSongDraftAudio(draft.id) : null;
    if (draft && audio) {
      const lyrics = draft.sections.flatMap((section) => section.lines).join("\n");
      return { sections: draft.sections, words: draft.words, audio, style: draft.style, lyrics };
    }
    console.error("The approved song take is missing. Composing a new one.", { jobId, songId: input.songId });
  }
  const model = generationModelBySlug(input.model);
  if (!model) throw new Error("Pick a video model.");
  const brief = await extractSongBrief(input.prompt);
  const sections = planSongSections(splitLyricSections(brief.lyrics), input.length, lyricsClipDurations(model, hasSinger));
  const composed = await composeSong({
    sections,
    style: brief.style || input.visualDirection || "pop",
    idempotencyKey: `song:${jobId}`,
  });
  const voice = await resolveCharacterVoice(userId, input.characterId).catch(() => null);
  const audio = voice ? (await singAs(composed.bytes, voice.providerVoiceId)).mix : composed.bytes;
  return { sections, words: composed.words, audio, style: brief.style, lyrics: brief.lyrics };
};

const filmSongVideo = async (userId: string, jobId: string, input: JobInput) => {
  const model = generationModelBySlug(input.model);
  if (!model) throw new Error("Pick a video model.");
  const row = await db.videoJob.findFirst({ where: { id: jobId, userId }, select: { artifacts: true } });
  let song = readStoredSong(row?.artifacts);
  let songBytes = song ? await readVideoMedia(songMediaKey(jobId)) : null;
  if (!song || !songBytes) {
    if (!(await markVideoJobProgress(jobId, "script", 10))) return;
    const hasSinger = (input.referenceKeys?.length ?? 0) > 0;
    const { sections, words, audio, ...brief } = await songForJob(userId, jobId, input, hasSinger);
    const shots = planShots(sections, hasSinger);
    const composed = { bytes: audio, words };
    await putVideoMedia(songMediaKey(jobId), composed.bytes, "audio/mpeg");
    const visuals = await writeBeats({
      prompt: [
        brief.style ? `Music: ${brief.style}` : "",
        ...shots.map((shot) => `Shot ${shot.index + 1} (${shot.durationSec}s): ${shot.lines.join(" / ") || shot.sectionName}`),
      ]
        .filter(Boolean)
        .join("\n"),
      segments: shots.map((shot) => shot.durationSec),
      mode: "song",
    });
    const preset = await resolveJobPreset({
      userId,
      prompt: brief.style || brief.lyrics || input.prompt,
      mode: "lyrics",
      engine: "footage",
      presetId: input.presetId,
      visualDirection: input.visualDirection,
    });
    const styled = preset && preset.id !== AUTO_PRESET_ID ? preset : preset;
    const prompts = shots.map((shot, index) =>
      songPrompt(
        visuals[index] || shot.lines.join(". ") || shot.sectionName,
        shot,
        styled,
        input.visualDirection,
        hasSinger,
      ),
    );
    song = { style: brief.style, sections, shots, words: composed.words, prompts };
    songBytes = composed.bytes;
    await rememberSong(jobId, row?.artifacts, song);
  }
  if (!(await isStillRunning(userId, jobId)) || !song || !songBytes) return;
  const shots = song.shots;
  const prompts = song.prompts.length === shots.length ? song.prompts : shots.map((shot) => shot.sectionName);
  if (!(await markVideoJobProgress(jobId, "videos", progressFor("videos", 0, shots.length)))) return;

  let next = 0;
  let filmed = 0;
  let hold = false;
  let failure: unknown = null;
  const workerCount = Math.min(SONG_CONCURRENCY, Math.max(shots.length, 1));
  const workers = Array.from({ length: workerCount }, async () => {
    while (!failure) {
      if (!(await isStillRunning(userId, jobId))) {
        failure = new FootageStopped();
        return;
      }
      if (!hold && filmed > 0 && (await stopRequested(jobId))) hold = true;
      if (hold || next >= shots.length) return;
      const shot = shots[next];
      next += 1;
      if (!shot) return;
      try {
        await filmSongShot(userId, jobId, input, shot, prompts[shot.index] ?? shot.sectionName, songBytes);
        filmed += 1;
        await markVideoJobProgress(jobId, "videos", progressFor("videos", filmed, shots.length));
      } catch (error) {
        failure = error;
        return;
      }
    }
  });
  await Promise.all(workers);
  if (failure instanceof FootageStopped) throw failure;
  if (failure) throw failure;

  const stored = await readStoredClips(jobId, shots.length);
  if (stored.length < shots.length) {
    if (stored.length < 1 || !songBytes) return;
    const durations = shots.slice(0, stored.length).map((shot) => shot.durationSec);
    const duration = durations.reduce((total, part) => total + part, 0);
    if (!(await markVideoJobProgress(jobId, "render", progressFor("render")))) return;
    const bytes = await assembleSongVideo({
      clips: stored,
      durations,
      song: songBytes,
      words: song.words,
      showText: input.showText !== false,
    });
    const narration = shots
      .slice(0, stored.length)
      .flatMap((shot) => shot.lines)
      .join("\n");
    await pauseWithCut(userId, jobId, input, bytes, duration, narration, stored.length, shots.length);
    return;
  }

  if (!(await markVideoJobProgress(jobId, "render", 80))) return;
  const bytes = await assembleSongVideo({
    clips: stored,
    durations: shots.map((shot) => shot.durationSec),
    song: songBytes,
    words: song.words,
    showText: input.showText !== false,
  });
  const narration = shots.flatMap((shot) => shot.lines).join("\n");
  const duration = shots.reduce((total, shot) => total + shot.durationSec, 0);
  await storeClip(userId, jobId, input, duration, bytes, narration);
  await Promise.all(shots.map((shot) => deleteVideoMedia(segmentMediaKey(jobId, shot.index)).catch(() => undefined)));
};

const filmSegments = async (
  userId: string,
  jobId: string,
  input: JobInput,
  prepared: PreparedJob,
  segments: number[],
  speech: Uint8Array | null,
) => {
  const beats = prepared.beats.length === segments.length ? prepared.beats : segments.map(() => prepared.prompt);
  await db.videoJob.update({
    where: { id: jobId },
    data: { artifacts: { segments, beats, spoken: prepared.spoken ?? "" } },
  });
  if (!(await markVideoJobProgress(jobId, "videos", progressFor("videos", 0, segments.length)))) {
    throw new FootageStopped();
  }

  const clipBytes: Uint8Array[] = [];
  let lastFrame: string | undefined;
  for (let index = 0; index < segments.length; index += 1) {
    if (!(await isStillRunning(userId, jobId))) throw new FootageStopped();
    const clip = await filmOneSegment({
      userId,
      jobId,
      input,
      prepared,
      index,
      duration: segments[index]!,
      prompt: beats[index] ?? prepared.prompt,
      startFrame: index === 0 ? prepared.imageDataUrl : lastFrame,
    });
    clipBytes.push(clip.bytes);
    if (index < segments.length - 1) lastFrame = await lastFrameDataUrl(clip.bytes);
    if (!(await markVideoJobProgress(jobId, "videos", progressFor("videos", index + 1, segments.length)))) {
      throw new FootageStopped();
    }
    if (!clip.cached && shouldHoldAfterClip(index, segments.length, await stopRequested(jobId))) {
      await publishPartial(userId, jobId, input, segments, beats, speech);
      return;
    }
  }

  const stitched = await stitchClips(clipBytes);
  const duration = segments.reduce((sum, part) => sum + part, 0);
  const voiced = speech ? await mixNarration(stitched, speech, duration) : stitched;
  await storeClip(userId, jobId, input, duration, voiced, prepared.spoken?.trim() || beats.join("\n\n"));
  await Promise.all(segments.map((_, index) => deleteVideoMedia(segmentKey(jobId, index)).catch(() => undefined)));
};

const filmOneSegment = async (input: {
  userId: string;
  jobId: string;
  input: JobInput;
  prepared: PreparedJob;
  index: number;
  duration: number;
  prompt: string;
  startFrame?: string;
}) => {
  const key = segmentKey(input.jobId, input.index);
  const stored = await readVideoMedia(key);
  if (stored) return { bytes: stored, cached: true };

  const request: FootageRequest = {
    prompt: input.prompt,
    format: input.input.format,
    length: input.duration,
    model: input.input.model,
    resolution: input.prepared.resolution ?? input.input.resolution,
    imageDataUrl: input.startFrame,
    inputReferences: input.index === 0 ? input.prepared.inputReferences : undefined,
  };
  const shouldContinue = () => isStillRunning(input.userId, input.jobId);

  const open = await db.providerJob.findFirst({
    where: { jobId: input.jobId, sceneIdx: input.index, status: { in: ["pending", "in_progress"] } },
  });
  if (open) {
    try {
      const model = generationModelBySlug(input.input.model);
      const bytes = await finishFootage(
        open.providerJobId,
        isVideoProvider(open.provider) ? open.provider : (model?.provider ?? "openrouter"),
        shouldContinue,
      );
      await finishProviderClip(open.providerJobId, "completed", input.input.model);
      await putVideoMedia(key, bytes, "video/mp4");
      return { bytes, cached: false };
    } catch (error) {
      if (error instanceof FootageStopped) throw error;
      if (error instanceof TypeError && (error.message === "fetch failed" || error.message === "terminated")) throw error;
      await finishProviderClip(open.providerJobId, "failed", input.input.model);
      console.error("Clip failed, retrying once", { jobId: input.jobId, sceneIdx: input.index, error });
      const clip = await renderFootage(request, shouldContinue, (providerJobId, provider) =>
        rememberProviderJob(input.jobId, providerJobId, provider, input.index, input.input.model),
      );
      await finishSceneClip(input.jobId, input.index, "completed", input.input.model);
      await putVideoMedia(key, clip.bytes, "video/mp4");
      return { bytes: clip.bytes, cached: false };
    }
  }

  const clip = await renderSegmentWithRetry(input.jobId, input.index, request, shouldContinue);
  await putVideoMedia(key, clip.bytes, "video/mp4");
  return { bytes: clip.bytes, cached: false };
};

const renderSegmentWithRetry = async (
  jobId: string,
  sceneIdx: number,
  request: FootageRequest,
  shouldContinue: () => Promise<boolean>,
) => {
  const submit = async () => {
    const clip = await renderFootage(request, shouldContinue, (providerJobId, provider) =>
      rememberProviderJob(jobId, providerJobId, provider, sceneIdx, request.model),
    );
    await finishSceneClip(jobId, sceneIdx, "completed", request.model);
    return clip;
  };
  try {
    return await submit();
  } catch (error) {
    if (error instanceof FootageStopped) throw error;
    if (error instanceof TypeError && (error.message === "fetch failed" || error.message === "terminated")) throw error;
    console.error("Clip failed, retrying once", { jobId, sceneIdx, error });
    return submit();
  }
};

const filmDemo = async (userId: string, jobId: string, input: JobInput) => {
  const record: VideoRecord = {
    ...readyRecord(jobId, input, normalizePlan(DEMO_PLAN, input.length), input.length, true),
    title: DEMO_PLAN.title,
    facts: DEMO_FACTS,
    quotes: DEMO_QUOTES,
  };
  await createVideo(userId, record);
  if (!(await isStillRunning(userId, jobId))) return;
  await markVideoJobProgress(jobId, "finalize", 100);
  await transitionVideoJob(jobId, "succeeded", { outputUrl: null, error: null });
};

/** A failed edit export stays on its job, where the export dialog shows the error. It is not a video. */
const saveFailedVideo = async (userId: string, jobId: string, input: ReturnType<typeof readJobInput>, message: string) => {
  if (input.mode === "editor-export") return;
  const format = isFormat(input.format) ? input.format : "9:16";
  try {
    await createVideo(userId, {
      id: jobId,
      prompt: input.prompt,
      format,
      length: input.length > 0 ? input.length : 2,
      status: "failed",
      createdAt: new Date().toISOString(),
      title: input.prompt.slice(0, 80),
      facts: [],
      quotes: [],
      plan: null,
      searchSources: [],
      unverifiedFactIds: [],
      model: input.model || "unknown",
      demo: !hasOpenRouterKey(),
      error: message,
    });
  } catch (error) {
    console.error("Could not save the failed video", error);
  }
};

/** A dropped connection is not a result. The row stays running so the wait can continue. */
const leaveRunningOnSilence = (jobId: string, error: unknown) => {
  if (!(error instanceof TypeError)) return false;
  if (error.message !== "fetch failed" && error.message !== "terminated") return false;
  console.error("The video model has not replied. Leaving the job running.", { jobId, cause: error.cause });
  return true;
};

const isStillRunning = async (userId: string, jobId: string) => {
  const updated = await db.videoJob.updateMany({
    where: { id: jobId, userId, status: "running" },
    data: { heartbeatAt: new Date() },
  });
  return updated.count === 1;
};

const readyRecord = (
  jobId: string,
  input: JobInput,
  plan: ScenePlan,
  length: number,
  demo: boolean,
): VideoRecord => ({
  id: jobId,
  prompt: input.prompt,
  format: input.format,
  length,
  status: "ready",
  createdAt: new Date().toISOString(),
  title: plan.title,
  facts: [],
  quotes: [],
  plan,
  searchSources: [],
  unverifiedFactIds: [],
  model: input.model,
  demo,
  error: null,
});

const footagePlan = (prompt: string, durationSec: number, narration = prompt): ScenePlan => {
  const title = titleFromPrompt(prompt);
  return {
    title,
    scenes: [
      {
        type: "footage",
        headline: title,
        narration: narration.trim(),
        factIds: [],
        quote: null,
        durationSec,
      },
    ],
  };
};

const titleFromPrompt = (prompt: string) => {
  const trimmed = prompt.trim().replace(/[.?!]+$/g, "");
  const short = trimmed.length > 72 ? `${trimmed.slice(0, 72).trim()}…` : trimmed;
  return short.charAt(0).toUpperCase() + short.slice(1);
};

const isFormat = (value: string): value is VideoFormat => (VIDEO_FORMATS as readonly string[]).includes(value);

const readSpoken = (artifacts: unknown) => {
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return "";
  const spoken = (artifacts as Record<string, unknown>).spoken;
  return typeof spoken === "string" ? spoken.trim() : "";
};

const rememberSpoken = async (jobId: string, artifacts: unknown, spoken: string) => {
  if (readSpoken(artifacts) === spoken) return;
  const current =
    artifacts && typeof artifacts === "object" && !Array.isArray(artifacts)
      ? (artifacts as Record<string, unknown>)
      : {};
  await db.videoJob.update({
    where: { id: jobId },
    data: { artifacts: { ...current, spoken } },
  });
};

const toJobInput = (input: ReturnType<typeof readJobInput>): JobInput => ({
  prompt: input.prompt,
  format: input.format as VideoFormat,
  length: input.length,
  model: input.model,
  mode: input.mode || undefined,
  tier: input.tier || undefined,
  resolution: input.resolution || undefined,
  mediaKey: input.mediaKey || input.imageKey || undefined,
  referenceKeys: input.referenceKeys.length > 0 ? input.referenceKeys : undefined,
  showText: input.showText,
  projectId: input.projectId || undefined,
  presetId: input.presetId || undefined,
  visualDirection: input.visualDirection || undefined,
  characterId: input.characterId || undefined,
  songId: input.songId || undefined,
});
