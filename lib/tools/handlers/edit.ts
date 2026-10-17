import "server-only";
import { transcribeMedia } from "@/lib/ai/transcribe";
import {
  addCaptionsEdit,
  addMusicEdit,
  addTextEdit,
  captionLinesFromTranscript,
  moveEdit,
  readTimeline,
  removeEdit,
  setVolumeEdit,
  splitEdit,
  trimEdit,
  updateTextEdit,
  type EditChange,
  type TextPosition,
} from "@/lib/editor/coach-edits";
import { applyProjectEdit, getProjectForUser } from "@/lib/editor/projects";
import { timelineDurationInFrames, type Asset, type Timeline } from "@/lib/editor/schema";
import type { EditProjectView } from "@/lib/editor/types";
import { readSongDraft } from "@/lib/music/song-draft";
import { isOwnedUploadKey } from "@/lib/storage/upload-key";
import type { ToolContext, ToolHandler } from "@/lib/tools/types";
import { readVideoMedia } from "@/lib/video/media-store";
import { FPS } from "@/lib/video/schema";
import { getVideoForUser } from "@/lib/videos";
import { asRecord, text } from "./support";

const MAX_TRANSCRIPT_BYTES = 8_000_000;

const projectIdOf = (input: Record<string, unknown>, ctx: ToolContext) => text(input.projectId) || ctx.projectId || "";

const positionOf = (value: unknown): TextPosition | undefined =>
  value === "top" || value === "center" || value === "bottom" ? value : undefined;

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
) => {
  const projectId = projectIdOf(input, ctx);
  if (!projectId) return { error: "This chat has no video project yet." };
  try {
    let change: EditChange | null = null;
    const project = await applyProjectEdit(ctx.userId, projectId, (timeline) => {
      change = edit(timeline);
      return change.timeline;
    });
    if (!change) return { error: "Couldn't edit that timeline." };
    return saved(project, change, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't edit that timeline.";
    return { error: message === "Not found." ? "That project was not found." : message };
  }
};

export const editReadTimelineHandler: ToolHandler = async (input, ctx) => {
  const projectId = projectIdOf(asRecord(input), ctx);
  if (!projectId) return { error: "This chat has no video project yet." };
  const project = await getProjectForUser(ctx.userId, projectId);
  if (!project) return { error: "That project was not found." };
  return readTimeline(project.timeline);
};

export const editAddTextHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const words = text(row.text);
  if (!words) return { error: "Pass the words to show." };
  return runEdit(ctx, row, `Added “${words}”.`, (timeline) =>
    addTextEdit(timeline, {
      text: words,
      startSec: numberOf(row.startSec),
      endSec: numberOf(row.endSec),
      position: positionOf(row.position),
    }),
  );
};

export const editUpdateTextHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const itemId = text(row.itemId);
  if (!itemId) return { error: "Pass the text clip id." };
  return runEdit(ctx, row, "Updated the title.", (timeline) =>
    updateTextEdit(timeline, { itemId, text: text(row.text) || undefined, position: positionOf(row.position) }),
  );
};

export const editTrimHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const itemId = text(row.itemId);
  if (!itemId) return { error: "Pass the clip id." };
  return runEdit(ctx, row, "Trimmed the clip.", (timeline) =>
    trimEdit(timeline, { itemId, startSec: numberOf(row.startSec), endSec: numberOf(row.endSec) }),
  );
};

export const editSplitHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const itemId = text(row.itemId);
  const atSec = numberOf(row.atSec);
  if (!itemId || atSec == null) return { error: "Pass the clip id and where to split." };
  return runEdit(ctx, row, "Split the clip.", (timeline) => splitEdit(timeline, { itemId, atSec }));
};

export const editRemoveHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const itemId = text(row.itemId);
  if (!itemId) return { error: "Pass the clip id." };
  return runEdit(ctx, row, "Removed the clip.", (timeline) =>
    removeEdit(timeline, { itemId, ripple: row.ripple === true }),
  );
};

export const editMoveHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const itemId = text(row.itemId);
  const startSec = numberOf(row.startSec);
  if (!itemId || startSec == null) return { error: "Pass the clip id and the new start." };
  return runEdit(ctx, row, "Moved the clip.", (timeline) => moveEdit(timeline, { itemId, startSec }));
};

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
  return runEdit(ctx, row, "Added music under the video.", (timeline) =>
    addMusicEdit(timeline, asset, {
      startSec: numberOf(row.startSec),
      volume: numberOf(row.volume),
      fadeInSec: numberOf(row.fadeInSec),
      fadeOutSec: numberOf(row.fadeOutSec),
    }),
  );
};

export const editSetVolumeHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  return runEdit(ctx, row, "Updated the volume.", (timeline) =>
    setVolumeEdit(timeline, {
      itemId: text(row.itemId) || undefined,
      trackId: text(row.trackId) || undefined,
      volume: numberOf(row.volume),
      muted: typeof row.muted === "boolean" ? row.muted : undefined,
    }),
  );
};

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
