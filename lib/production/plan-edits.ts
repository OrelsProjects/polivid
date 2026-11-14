import "server-only";
import { db } from "@/lib/db";
import { estimateProductionCredits } from "@/lib/billing/production";
import { loadDevelop, loadStructure } from "./jobs/coordinator";
import { readHints, type ProductionHints } from "./hints";
import type { AudioSegment, AudioTrack, DevelopOutput, InputRecord, Shot, StructureOutput } from "./schema";
import { AUDIO_TRACKS } from "./schema";
import { currentEntityData, putEntity } from "./store";
import { validateStructure } from "./validate";

export class PlanEditError extends Error {}

/** Planning statuses where nothing has been filmed yet, so the plan can still change for free. */
const EDITABLE_STATUSES = new Set(["preview", "awaiting_answers", "failed"]);

const loadEditable = async (userId: string, productionId: string) => {
  const production = await db.production.findFirst({ where: { id: productionId, userId } });
  if (!production) throw new PlanEditError("Production not found.");
  const filming = await db.productionStep.count({ where: { productionId } });
  if (filming > 0 || !EDITABLE_STATUSES.has(production.status)) {
    throw new PlanEditError(
      "Filming already started, so the plan is locked. Use production_refilm_shot to redo a shot, or edit the finished cut with the edit_* tools.",
    );
  }
  const structure = await loadStructure(productionId);
  const develop = await loadDevelop(productionId);
  if (!structure) throw new PlanEditError("This production has no shot plan yet. Wait for planning to finish.");
  return { production, structure, develop };
};

/**
 * Checks the edited plan with the planner's own validator before saving.
 * Only errors block; warnings come back so the agent can mention them.
 */
const check = (develop: DevelopOutput | null, structure: StructureOutput) => {
  if (!develop) return [];
  const result = validateStructure(develop, structure);
  const errors = result.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new PlanEditError(errors.map((issue) => issue.message).join(" "));
  return result.issues.map((issue) => issue.message);
};

const summary = async (productionId: string, warnings: string[], note: string) => {
  const structure = await loadStructure(productionId);
  return {
    productionId,
    note,
    warnings,
    credits: await estimateProductionCredits(productionId),
    shots: [...(structure?.shots ?? [])].sort((a, b) => a.order - b.order).map(shotView),
    audio: (structure?.audioSegments ?? []).map(audioView),
  };
};

export const shotView = (shot: Shot) => ({
  id: shot.id,
  sceneId: shot.sceneId,
  order: shot.order,
  seconds: shot.editDurationSec,
  generationSeconds: shot.generationDurationSec,
  purpose: shot.purpose,
  action: shot.action,
  framing: shot.framing,
  cameraMotion: shot.cameraMotion,
  continuity: shot.continuity,
  speechMode: shot.speechMode,
  characterIds: shot.characterIds,
  audioSegmentIds: shot.audioSegmentIds,
});

export const audioView = (segment: AudioSegment) => ({
  id: segment.id,
  track: segment.track,
  shotIds: segment.shotIds,
  startOffsetSec: segment.startOffsetSec,
  seconds: segment.durationSec,
  text: segment.text,
  prompt: segment.prompt,
  voiceId: segment.voiceId,
  fadeInSec: segment.fadeInSec,
  fadeOutSec: segment.fadeOutSec,
});

export interface ShotPatch {
  action?: string;
  purpose?: string;
  framing?: string;
  cameraMotion?: string;
  emotionalArc?: string;
  intendedBeginning?: string;
  intendedEnding?: string;
  seconds?: number;
  speechMode?: Shot["speechMode"];
  /** Create model id, or "" to go back to the production default. */
  model?: string;
}

const saveHints = async (productionId: string, update: (hints: ProductionHints) => ProductionHints) => {
  const input = await currentEntityData<InputRecord>(productionId, "input", "input");
  if (!input) throw new PlanEditError("This production has no input.");
  await putEntity(productionId, "input", "input", { ...input, hints: update(readHints(input.hints)) }, "user");
};

export const updateShot = async (userId: string, productionId: string, shotId: string, patch: ShotPatch) => {
  const { structure, develop } = await loadEditable(userId, productionId);
  const shot = structure.shots.find((entry) => entry.id === shotId);
  if (!shot) throw new PlanEditError("That shot is not in the plan. Use a shot id from get_production.");
  const next: Shot = {
    ...shot,
    ...(patch.action !== undefined ? { action: patch.action } : {}),
    ...(patch.purpose !== undefined ? { purpose: patch.purpose } : {}),
    ...(patch.framing !== undefined ? { framing: patch.framing } : {}),
    ...(patch.cameraMotion !== undefined ? { cameraMotion: patch.cameraMotion } : {}),
    ...(patch.emotionalArc !== undefined ? { emotionalArc: patch.emotionalArc } : {}),
    ...(patch.intendedBeginning !== undefined ? { intendedBeginning: patch.intendedBeginning } : {}),
    ...(patch.intendedEnding !== undefined ? { intendedEnding: patch.intendedEnding } : {}),
    ...(patch.speechMode ? { speechMode: patch.speechMode } : {}),
    ...(patch.seconds !== undefined ? { editDurationSec: patch.seconds, generationDurationSec: Math.max(patch.seconds, 1) } : {}),
  };
  const edited = { ...structure, shots: structure.shots.map((entry) => (entry.id === shotId ? next : entry)) };
  const warnings = check(develop, edited);
  await putEntity(productionId, "shot", shotId, next, "user");
  if (patch.model !== undefined) {
    await saveHints(productionId, (hints) => {
      const shotModels = { ...(hints.shotModels ?? {}) };
      if (patch.model) shotModels[shotId] = patch.model;
      else delete shotModels[shotId];
      return { ...hints, shotModels };
    });
  }
  return summary(productionId, warnings, "Shot updated.");
};

export const removeShot = async (userId: string, productionId: string, shotId: string) => {
  const { structure, develop } = await loadEditable(userId, productionId);
  const shot = structure.shots.find((entry) => entry.id === shotId);
  if (!shot) throw new PlanEditError("That shot is not in the plan.");
  if (structure.shots.length <= 1) throw new PlanEditError("A production needs at least one shot.");
  const shots = structure.shots
    .filter((entry) => entry.id !== shotId)
    .map((entry) =>
      entry.dependsOn === shotId
        ? { ...entry, dependsOn: shot.dependsOn, continuity: shot.dependsOn ? entry.continuity : ("new_scene" as const) }
        : entry,
    )
    .sort((a, b) => a.order - b.order)
    .map((entry, order) => ({ ...entry, order }));
  const audio = structure.audioSegments
    .map((segment) => ({ ...segment, shotIds: segment.shotIds.filter((id) => id !== shotId) }))
    .filter((segment) => segment.shotIds.length > 0);
  const droppedAudio = structure.audioSegments.filter((segment) => !audio.some((kept) => kept.id === segment.id)).map((s) => s.id);
  const edited: StructureOutput = {
    ...structure,
    shots: shots.map((entry) => ({ ...entry, audioSegmentIds: entry.audioSegmentIds.filter((id) => !droppedAudio.includes(id)) })),
    audioSegments: audio,
  };
  const warnings = check(develop, edited);
  await db.productionEntity.deleteMany({ where: { productionId, kind: "shot", stableKey: shotId } });
  for (const id of droppedAudio) await db.productionEntity.deleteMany({ where: { productionId, kind: "audio_segment", stableKey: id } });
  for (const entry of edited.shots) await putEntity(productionId, "shot", entry.id, entry, "user");
  for (const segment of edited.audioSegments) {
    const before = structure.audioSegments.find((item) => item.id === segment.id);
    if (before && before.shotIds.length !== segment.shotIds.length) await putEntity(productionId, "audio_segment", segment.id, segment, "user");
  }
  return summary(productionId, warnings, `Shot removed${droppedAudio.length ? `, with ${droppedAudio.length} sound segment(s) that only played under it` : ""}.`);
};

export interface AudioPatch {
  text?: string | null;
  prompt?: string | null;
  voiceId?: string | null;
  seconds?: number;
  startOffsetSec?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  shotIds?: string[];
}

const applyAudioPatch = (segment: AudioSegment, patch: AudioPatch): AudioSegment => ({
  ...segment,
  ...(patch.text !== undefined ? { text: patch.text } : {}),
  ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
  ...(patch.voiceId !== undefined ? { voiceId: patch.voiceId } : {}),
  ...(patch.seconds !== undefined ? { durationSec: patch.seconds, measuredDurationSec: null } : {}),
  ...(patch.startOffsetSec !== undefined ? { startOffsetSec: patch.startOffsetSec } : {}),
  ...(patch.fadeInSec !== undefined ? { fadeInSec: patch.fadeInSec } : {}),
  ...(patch.fadeOutSec !== undefined ? { fadeOutSec: patch.fadeOutSec } : {}),
  ...(patch.shotIds ? { shotIds: patch.shotIds } : {}),
});

/** Keeps each shot's audioSegmentIds in step with the segments' shotIds. */
const linkAudio = (structure: StructureOutput): StructureOutput => ({
  ...structure,
  shots: structure.shots.map((shot) => ({
    ...shot,
    audioSegmentIds: structure.audioSegments.filter((segment) => segment.shotIds.includes(shot.id)).map((segment) => segment.id),
  })),
});

const saveAudioChange = async (productionId: string, before: StructureOutput, after: StructureOutput) => {
  for (const segment of after.audioSegments) {
    const old = before.audioSegments.find((item) => item.id === segment.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(segment)) await putEntity(productionId, "audio_segment", segment.id, segment, "user");
  }
  for (const shot of after.shots) {
    const old = before.shots.find((item) => item.id === shot.id);
    if (old && old.audioSegmentIds.join() !== shot.audioSegmentIds.join()) await putEntity(productionId, "shot", shot.id, shot, "user");
  }
};

const knownShots = (structure: StructureOutput, ids: string[] | undefined) => {
  if (!ids) return;
  const missing = ids.filter((id) => !structure.shots.some((shot) => shot.id === id));
  if (missing.length) throw new PlanEditError(`Unknown shot ids: ${missing.join(", ")}.`);
  if (ids.length === 0) throw new PlanEditError("A sound must play under at least one shot.");
};

export const updateAudio = async (userId: string, productionId: string, segmentId: string, patch: AudioPatch) => {
  const { structure, develop } = await loadEditable(userId, productionId);
  const segment = structure.audioSegments.find((entry) => entry.id === segmentId);
  if (!segment) throw new PlanEditError("That sound segment is not in the plan. Use an audio id from get_production.");
  knownShots(structure, patch.shotIds);
  const edited = linkAudio({
    ...structure,
    audioSegments: structure.audioSegments.map((entry) => (entry.id === segmentId ? applyAudioPatch(entry, patch) : entry)),
  });
  const warnings = check(develop, edited);
  await saveAudioChange(productionId, structure, edited);
  return summary(productionId, warnings, "Sound updated.");
};

export const addAudio = async (
  userId: string,
  productionId: string,
  input: { track: AudioTrack } & AudioPatch & { shotIds: string[]; seconds: number },
) => {
  const { structure, develop } = await loadEditable(userId, productionId);
  if (!(AUDIO_TRACKS as readonly string[]).includes(input.track)) throw new PlanEditError(`track must be one of ${AUDIO_TRACKS.join(", ")}.`);
  knownShots(structure, input.shotIds);
  const spoken = input.track === "dialogue" || input.track === "narration";
  if (spoken && !input.text?.trim()) throw new PlanEditError("Dialogue and narration need the words in text.");
  if (!spoken && !input.prompt?.trim()) throw new PlanEditError("Music, ambience, and sound effects need a prompt describing the sound.");
  const id = `${input.track}_${crypto.randomUUID().slice(0, 8)}`;
  const segment: AudioSegment = {
    id,
    track: input.track,
    shotIds: input.shotIds,
    startOffsetSec: input.startOffsetSec ?? 0,
    durationSec: input.seconds,
    text: spoken ? (input.text ?? null) : null,
    voiceId: input.voiceId ?? null,
    nativeAudioPolicy: "mix",
    fadeInSec: input.fadeInSec ?? (input.track === "music" ? 0.5 : 0),
    fadeOutSec: input.fadeOutSec ?? (input.track === "music" ? 1 : 0),
    prompt: spoken ? null : (input.prompt ?? null),
    measuredDurationSec: null,
  };
  const edited = linkAudio({ ...structure, audioSegments: [...structure.audioSegments, segment] });
  const warnings = check(develop, edited);
  await saveAudioChange(productionId, structure, edited);
  return { ...(await summary(productionId, warnings, "Sound added.")), audioId: id };
};

export const removeAudio = async (userId: string, productionId: string, segmentId: string) => {
  const { structure, develop } = await loadEditable(userId, productionId);
  if (!structure.audioSegments.some((entry) => entry.id === segmentId)) throw new PlanEditError("That sound segment is not in the plan.");
  const edited = linkAudio({ ...structure, audioSegments: structure.audioSegments.filter((entry) => entry.id !== segmentId) });
  const warnings = check(develop, edited);
  await db.productionEntity.deleteMany({ where: { productionId, kind: "audio_segment", stableKey: segmentId } });
  await saveAudioChange(productionId, structure, edited);
  return summary(productionId, warnings, "Sound removed.");
};

/** Saves new planning hints. The caller re-plans afterwards. */
export const setHints = async (userId: string, productionId: string, hints: ProductionHints) => {
  await loadEditable(userId, productionId).catch((error) => {
    // A production still drafting its first plan can take hints too.
    if (!(error instanceof PlanEditError) || !/no shot plan/.test(error.message)) throw error;
  });
  await saveHints(productionId, (current) => ({ ...current, ...hints, shotModels: hints.shotModels ?? current.shotModels }));
};
