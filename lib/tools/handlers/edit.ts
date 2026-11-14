import "server-only";
import { transcribeMedia } from "@/lib/ai/transcribe";
import {
  addCaptionsEdit,
  addMediaEdit,
  addMusicEdit,
  captionLinesFromTranscript,
  readTimeline,
  type EditChange,
} from "@/lib/editor/coach-edits";
import {
  applyProjectEdit,
  getProjectForUser,
  listRevisionsForUser,
  restoreRevisionForUser,
  revertProjectForUser,
  undoLastEditForUser,
} from "@/lib/editor/projects";
import { timelineDurationInFrames, type Asset, type Timeline } from "@/lib/editor/schema";
import type { EditProjectView } from "@/lib/editor/types";
import { getCharacter } from "@/lib/characters/store";
import { db } from "@/lib/db";
import { readSongDraft } from "@/lib/music/song-draft";
import { probeFile } from "@/lib/production/review/ffmpeg";
import { signedGetUrl } from "@/lib/storage/s3";
import { isAudioKey, isImageKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import type { ToolContext, ToolHandler } from "@/lib/tools/types";
import { describeClipSound, spokenFromArtifacts } from "@/lib/video/clip-sound";
import { hasVoiceLayer } from "@/lib/video/footage";
import { readJobInput } from "@/lib/video/job-status";
import { readVideoMedia } from "@/lib/video/media-store";
import { dimensionsFor, FPS } from "@/lib/video/schema";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";
import { getVideoForUser } from "@/lib/videos";
import { asRecord, text } from "./support";
import { combinePlans, EDIT_BUILDERS, EditInputError, type EditPlan } from "./edit-builders";

const MAX_TRANSCRIPT_BYTES = 8_000_000;

const projectIdOf = (input: Record<string, unknown>, ctx: ToolContext) => text(input.projectId) || ctx.projectId || "";

const numberOf = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const saved = (project: EditProjectView, change: EditChange, summary: string) => ({
  project,
  changedItemIds: change.changedItemIds,
  summary,
});

const runEdit = async (
  ctx: ToolContext,
  input: Record<string, unknown>,
  summary: string,
  edit: (timeline: Timeline) => EditChange,
  options: { title?: string } = {},
) => {
  const projectId = projectIdOf(input, ctx);
  if (!projectId) return { error: "This chat has no video project yet. Pass projectId from open_in_editor." };
  try {
    let change: EditChange | null = null;
    const project = await applyProjectEdit(
      ctx.userId,
      projectId,
      (timeline) => {
        change = edit(timeline);
        return change.timeline;
      },
      { title: options.title, reason: summary },
    );
    if (!change) return { error: "Couldn't edit that timeline." };
    return saved(project, change, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't edit that timeline.";
    return { error: message === "Not found." ? "That project was not found." : message };
  }
};

const runPlan = (ctx: ToolContext, row: Record<string, unknown>, build: (row: Record<string, unknown>) => EditPlan) => {
  let plan: EditPlan;
  try {
    plan = build(row);
  } catch (error) {
    if (error instanceof EditInputError) return Promise.resolve({ error: error.message });
    throw error;
  }
  return runEdit(ctx, row, plan.summary, plan.edit, { title: plan.title });
};

/** A handler for an edit tool that only changes the timeline. */
const planHandler =
  (name: keyof typeof EDIT_BUILDERS): ToolHandler =>
  async (input, ctx) =>
    runPlan(ctx, asRecord(input), EDIT_BUILDERS[name]);

const voiceWasUsed = async (userId: string, characterId: string) => {
  if (!characterId || characterId === OFF_VOICE_ID) return false;
  if (characterId === STUDIO_VOICE_ID) return true;
  const character = await getCharacter(userId, characterId);
  return Boolean(character?.providerVoiceId);
};

/** Footage has no voiceover. A character voice is stored beside it and played as its own clip. */
const soundForProject = async (userId: string, sourceVideoId: string | null) => {
  if (!sourceVideoId) return describeClipSound({ found: false, hasVoice: false });
  const job = await db.videoJob.findFirst({
    where: { id: sourceVideoId, userId },
    select: { input: true, artifacts: true },
  });
  if (!job) return describeClipSound({ found: false, hasVoice: false });
  const fields = readJobInput(job.input);
  const spoken = spokenFromArtifacts(job.artifacts);
  const layered = await hasVoiceLayer(sourceVideoId);
  return describeClipSound({
    found: true,
    mode: fields.mode,
    spoken,
    hasVoice: layered || (await voiceWasUsed(userId, fields.characterId)),
    layered,
  });
};

export const editReadTimelineHandler: ToolHandler = async (input, ctx) => {
  const projectId = projectIdOf(asRecord(input), ctx);
  if (!projectId) return { error: "This chat has no video project yet." };
  const project = await getProjectForUser(ctx.userId, projectId);
  if (!project) return { error: "That project was not found." };
  const timeline = readTimeline(project.timeline, { detail: asRecord(input).detail === true });
  const items = timeline.tracks.flatMap((track) => track.items);
  const videoItemId = items.find((item) => item.kind === "video")?.id ?? null;
  const voiceItemId = items.find((item) => item.kind === "audio" && item.name?.startsWith("Voiceover"))?.id ?? null;
  const sound = await soundForProject(ctx.userId, project.sourceVideoId);
  return {
    projectId: project.id,
    title: project.title,
    version: project.version,
    ...timeline,
    sound: { ...sound, videoItemId, voiceItemId },
  };
};

export const editAddTextHandler = planHandler("edit_add_text");
export const editUpdateTextHandler = planHandler("edit_update_text");
export const editTrimHandler = planHandler("edit_trim");
export const editSplitHandler = planHandler("edit_split");
export const editRemoveHandler = planHandler("edit_remove");
export const editMoveHandler = planHandler("edit_move");
export const editSetProjectHandler = planHandler("edit_set_project");
export const editAddTrackHandler = planHandler("edit_add_track");
export const editUpdateTrackHandler = planHandler("edit_update_track");
export const editRemoveTrackHandler = planHandler("edit_remove_track");
export const editReorderTrackHandler = planHandler("edit_reorder_track");
export const editDuplicateHandler = planHandler("edit_duplicate");
export const editCrossfadeHandler = planHandler("edit_crossfade");
export const editSetTransitionHandler = planHandler("edit_set_transition");
export const editSetTransformHandler = planHandler("edit_set_transform");
export const editStyleTextHandler = planHandler("edit_style_text");
export const editStyleCaptionsHandler = planHandler("edit_style_captions");
export const editRemoveCaptionsHandler = planHandler("edit_remove_captions");
export const editSetAudioHandler = planHandler("edit_set_audio");
export const editSetImageMotionHandler = planHandler("edit_set_image_motion");

const musicAsset = async (ctx: ToolContext, row: Record<string, unknown>, durationInFrames: number): Promise<Asset | { error: string }> => {
  const songId = text(row.songId);
  if (songId) {
    const draft = await readSongDraft(ctx.userId, songId);
    if (!draft) return { error: "That song was not found." };
    return {
      id: crypto.randomUUID(),
      kind: "audio",
      source: { type: "song", songId: draft.id },
      name: "Song",
      durationInFrames: Math.max(1, Math.round(draft.seconds * FPS)),
      width: null,
      height: null,
    };
  }
  const key = text(row.mediaKey) || ctx.attachedMedia.find((item) => item.kind === "audio")?.key;
  if (!key) return { error: "Pass a song id, or attach an audio file." };
  if (!isOwnedUploadKey(ctx.userId, key)) return { error: "That audio file is not in your library." };
  const seconds = numberOf(row.seconds);
  return {
    id: crypto.randomUUID(),
    kind: "audio",
    source: { type: "upload", key },
    name: "Audio",
    durationInFrames: Math.max(1, seconds != null ? Math.round(seconds * FPS) : durationInFrames),
    width: null,
    height: null,
  };
};

export const editAddMusicHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const projectId = projectIdOf(row, ctx);
  if (!projectId) return { error: "This chat has no video project yet." };
  const current = await getProjectForUser(ctx.userId, projectId);
  if (!current) return { error: "That project was not found." };
  const asset = await musicAsset(ctx, row, timelineDurationInFrames(current.timeline));
  if ("error" in asset) return asset;
  const role = row.role === "sfx" ? "sfx" : "music";
  return runEdit(ctx, row, role === "sfx" ? "Added a sound effect." : "Added music under the video.", (timeline) =>
    addMusicEdit(timeline, asset, {
      startSec: numberOf(row.startSec),
      volume: numberOf(row.volume),
      fadeInSec: numberOf(row.fadeInSec),
      fadeOutSec: numberOf(row.fadeOutSec),
      durationSec: numberOf(row.durationSec),
      role,
    }),
  );
};

export const editSetVolumeHandler = planHandler("edit_set_volume");

const captionLines = async (ctx: ToolContext, sourceVideoId: string | null, durationSec: number) => {
  if (sourceVideoId) {
    const video = await getVideoForUser(ctx.userId, sourceVideoId);
    const scenes = video?.plan?.scenes ?? [];
    const spoken = scenes.filter((scene) => scene.narration.trim());
    if (spoken.length > 0) {
      let start = 0;
      return scenes.map((scene) => {
        const line = { text: scene.narration.trim(), startSec: start, endSec: start + scene.durationSec };
        start += scene.durationSec;
        return line;
      }).filter((line) => line.text);
    }
    const bytes = await readVideoMedia(`${sourceVideoId}.mp4`);
    if (bytes && bytes.byteLength <= MAX_TRANSCRIPT_BYTES) {
      const dataUrl = `data:video/mp4;base64,${Buffer.from(bytes).toString("base64")}`;
      const transcript = await transcribeMedia(dataUrl, "video/mp4");
      return captionLinesFromTranscript(transcript, video?.length || durationSec);
    }
  }
  return [];
};

export const editAddCaptionsHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const projectId = projectIdOf(row, ctx);
  if (!projectId) return { error: "This chat has no video project yet." };
  const current = await getProjectForUser(ctx.userId, projectId);
  if (!current) return { error: "That project was not found." };
  const lines = await captionLines(ctx, current.sourceVideoId, timelineDurationInFrames(current.timeline) / FPS);
  if (lines.length === 0) return { error: "There's no speech to caption. Add titles with edit_add_text." };
  return runEdit(ctx, row, "Added captions.", (timeline) => addCaptionsEdit(timeline, lines));
};

const probeUpload = async (key: string) => {
  try {
    return await probeFile(await signedGetUrl(key, 600));
  } catch (error) {
    console.error("Could not probe an upload", error);
    return null;
  }
};

/** Builds the asset for edit_add_media from an upload key or a finished video. */
const mediaAsset = async (ctx: ToolContext, row: Record<string, unknown>): Promise<Asset | { error: string }> => {
  const videoId = text(row.videoId);
  if (videoId) {
    const video = await getVideoForUser(ctx.userId, videoId);
    if (!video || video.status !== "ready") return { error: "That video was not found, or it isn't ready." };
    const size = dimensionsFor(video.format);
    return {
      id: crypto.randomUUID(),
      kind: "video",
      source: { type: "video", videoId: video.id },
      name: video.title || "Video",
      durationInFrames: Math.max(1, Math.round((video.length || 5) * FPS)),
      width: size.width,
      height: size.height,
    };
  }
  const key = text(row.mediaKey);
  if (!key) return { error: "Pass a mediaKey from list_uploads or import_media_from_url, or a videoId." };
  if (!isOwnedUploadKey(ctx.userId, key)) return { error: "That file is not in your uploads." };
  const kind = isImageKey(key) ? "image" : isAudioKey(key) ? "audio" : isVideoKey(key) ? "video" : null;
  if (!kind) return { error: "That upload is not a picture, audio, or video file." };
  const given = numberOf(row.durationSec);
  const probe = kind === "image" && given != null ? null : await probeUpload(key);
  const seconds = kind === "image" ? null : probe?.durationSec || given || null;
  if (kind !== "image" && seconds == null) return { error: "Couldn't read that file's length. Pass durationSec." };
  return {
    id: crypto.randomUUID(),
    kind,
    source: { type: "upload", key },
    name: kind === "image" ? "Picture" : kind === "audio" ? "Audio" : "Clip",
    durationInFrames: seconds == null ? null : Math.max(1, Math.round(seconds * FPS)),
    width: probe?.width ?? null,
    height: probe?.height ?? null,
  };
};

export const editAddMediaHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  if (!projectIdOf(row, ctx)) return { error: "This chat has no video project yet. Pass projectId from open_in_editor." };
  const asset = await mediaAsset(ctx, row);
  if ("error" in asset) return asset;
  const role = row.role === "music" || row.role === "sfx" || row.role === "voice" ? row.role : undefined;
  return runEdit(ctx, row, `Added ${asset.kind === "image" ? "a picture" : asset.kind === "audio" ? "a sound" : "a clip"}.`, (timeline) =>
    addMediaEdit(timeline, asset, {
      startSec: numberOf(row.startSec),
      durationSec: numberOf(row.durationSec),
      trackId: text(row.trackId) || undefined,
      role,
    }),
  );
};

export const editBatchHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const ops = Array.isArray(row.ops) ? row.ops : [];
  if (ops.length === 0) return { error: "Pass at least one op." };
  const plans: EditPlan[] = [];
  for (const [index, raw] of ops.entries()) {
    const op = asRecord(raw);
    const name = text(op.tool) as keyof typeof EDIT_BUILDERS;
    const build = EDIT_BUILDERS[name];
    if (!build) return { error: `Op ${index + 1}: ${String(op.tool)} can't run in a batch.` };
    try {
      plans.push(build(asRecord(op.args)));
    } catch (error) {
      if (error instanceof EditInputError) return { error: `Op ${index + 1} (${name}): ${error.message}` };
      throw error;
    }
  }
  const plan = combinePlans(plans);
  return runEdit(ctx, row, plan.summary, plan.edit, { title: plan.title });
};

const projectOrError = (input: unknown, ctx: ToolContext) => {
  const projectId = projectIdOf(asRecord(input), ctx);
  return projectId ? { projectId } : { error: "This chat has no video project yet. Pass projectId from open_in_editor." };
};

export const editUndoHandler: ToolHandler = async (input, ctx) => {
  const target = projectOrError(input, ctx);
  if ("error" in target) return target;
  const outcome = await undoLastEditForUser(ctx.userId, target.projectId);
  if (outcome.result === "missing") return { error: "That project was not found." };
  if (outcome.result === "empty") return { error: "There is no agent edit to undo." };
  if (outcome.result === "moved") {
    return { error: `The timeline changed after “${outcome.reason}”. Use edit_list_revisions and edit_restore_revision to go back.` };
  }
  return { project: outcome.project, changedItemIds: [], summary: `Undid: ${outcome.reason}` };
};

export const editListRevisionsHandler: ToolHandler = async (input, ctx) => {
  const target = projectOrError(input, ctx);
  if ("error" in target) return target;
  const revisions = await listRevisionsForUser(ctx.userId, target.projectId);
  if (!revisions) return { error: "That project was not found." };
  return {
    note: "Each revision is the timeline as it was before the change in replacedBy.",
    revisions: revisions.map((revision) => ({
      id: revision.id,
      version: revision.version,
      replacedBy: revision.reason,
      savedAt: revision.createdAt,
    })),
  };
};

export const editRestoreRevisionHandler: ToolHandler = async (input, ctx) => {
  const target = projectOrError(input, ctx);
  if ("error" in target) return target;
  const project = await restoreRevisionForUser(ctx.userId, target.projectId, text(asRecord(input).revisionId));
  if (!project) return { error: "That revision was not found. Use an id from edit_list_revisions." };
  return { project, changedItemIds: [], summary: "Restored an earlier version." };
};

export const editRevertToOriginalHandler: ToolHandler = async (input, ctx) => {
  const target = projectOrError(input, ctx);
  if ("error" in target) return target;
  const project = await revertProjectForUser(ctx.userId, target.projectId);
  if (!project) return { error: "This project has no source video to go back to." };
  return { project, changedItemIds: [], summary: "Reverted to the original video. edit_undo brings the edits back." };
};
