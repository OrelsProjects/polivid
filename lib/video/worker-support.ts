import "server-only";
import type { CaptioningSettings } from "./captions";
import type { LayoutJobSettings } from "./layout/styles";
import { db } from "@/lib/db";
import type { ScenePlan, VideoFormat, VideoRecord } from "./schema";
import type { AttachmentAssignment, PromptBrief } from "./shot-plan";

/** A job's stored settings, as the runners read them. */
export interface JobInput {
  prompt: string;
  format: VideoFormat;
  length: number;
  model: string;
  mode?: string;
  /** `stills` draws pictures and moves the camera over them instead of filming. */
  media?: string;
  /** Read the script word for word instead of rewriting it to fit the length. */
  verbatim?: boolean;
  /** The quick edit an edit job makes, and its setting. */
  op?: string;
  opValue?: string;
  /** Character swap: `video` or `image` framing. */
  orientation?: string;
  /** Character swap: keep the uploaded video's sound. */
  keepSound?: boolean;
  /** Several clips run on from one another. Null or unset leaves it to the mode. */
  smoothTransitions?: boolean | null;
  /** A skit's approved plan: each beat's full shot and its sound. */
  skitPlan?: { shot: string; sound: string; hold?: number }[];
  /** Character swap: re-voice the speech in the character's voice. */
  characterVoice?: boolean;
  /** Character swap: every character swapped in, in the order of their pictures. */
  cast?: { characterId: string; characterLookId: string }[];
  /** The parts of the uploaded video to use, from the clip editor. */
  mediaRanges?: { start: number; end: number }[];
  /** Built-in clip behind a `loop` video. */
  backgroundId?: string;
  /** The person's own uploaded clip behind a `loop` video. */
  backgroundKey?: string;
  tier?: string;
  resolution?: string;
  mediaKey?: string;
  referenceKeys?: string[];
  showText?: boolean;
  projectId?: string;
  presetId?: string;
  visualDirection?: string;
  direction?: string;
  scene?: string;
  directionKeys?: string[];
  sceneKeys?: string[];
  characterId?: string;
  /** Written character profile added to every shot prompt. */
  characterNote?: string;
  /** Leading referenceKeys that show the character. */
  characterRefs?: number;
  /** Character clip sent to models that take video. */
  referenceClipKey?: string;
  vo?: string;
  songId?: string;
  cuts?: { seconds: number; camera: string; images?: number[]; action?: string; samePlace?: boolean }[];
  brief?: PromptBrief;
  attachmentRoles?: AttachmentAssignment[];
  /** A layout-style job: the style, the finished video it is applied to, and the uploads it may show. */
  layout?: LayoutJobSettings;
  /** A captions job that captions a finished video instead of an upload. */
  captioning?: CaptioningSettings;
  clips?: number;
}

/** True while the job is still ours to work on. Also tells the stall check a worker is alive. */
export const isStillRunning = async (userId: string, jobId: string) => {
  const updated = await db.videoJob.updateMany({
    where: { id: jobId, userId, status: "running" },
    data: { heartbeatAt: new Date() },
  });
  return updated.count === 1;
};

export const readyRecord = (
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

export const titleFromPrompt = (prompt: string) => {
  const trimmed = prompt.trim().replace(/[.?!]+$/g, "");
  const short = trimmed.length > 72 ? `${trimmed.slice(0, 72).trim()}…` : trimmed;
  return short.charAt(0).toUpperCase() + short.slice(1);
};
