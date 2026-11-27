/**
 * The finish step of a partner's video: once a UGC ad or talking avatar is filmed, it is laid out in
 * a style, given a caption preset's look, or both, as a new video linked to the first. Everything
 * here is plain logic; the routes and the webhook pass in what touches the database.
 */
import { skitLookOf } from "@/lib/video/skit";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { layoutStyleCredits, videoJobCredits } from "@/lib/billing/estimate";
import type { JobInputFields } from "@/lib/video/job-status";
import { LAYOUT_JOB_MODE, LAYOUT_MEDIA_ROLES, isLayoutStyleId, layoutStyleById, type LayoutMediaRole } from "@/lib/video/layout/styles";
import { MIN_VIDEO_LENGTH } from "@/lib/video/schema";
import { scriptSize } from "@/lib/video/script-markup";
import { STUDIO_VOICE_ID } from "@/lib/voice/constants";
import type { PartnerFinish, PartnerVideoInput } from "./video-request";

/** The finish request kept on the base video's job, and what became of it. */
export interface StoredFinish {
  style?: string;
  media?: { key: string; role: LayoutMediaRole; note?: string }[];
  captions?: string | false;
  /** Set once the base video finished: the follow-up was queued, or it couldn't be. */
  status?: "started" | "skipped";
  videoId?: string;
  reason?: string;
}

/** The job input key the finish request is kept under. */
export const FINISH_KEY = "partnerFinish";

export const storedFinishFrom = (finish: PartnerFinish): StoredFinish => ({
  ...(finish.style ? { style: finish.style } : {}),
  ...(finish.media?.length ? { media: finish.media.map((item) => ({ key: item.key, role: item.role, ...(item.note ? { note: item.note } : {}) })) } : {}),
  ...(finish.captions !== undefined ? { captions: finish.captions } : {}),
});

/** The finish request on a job's input, or null when it has none or it's broken. */
export const readStoredFinish = (input: unknown): StoredFinish | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = (input as Record<string, unknown>)[FINISH_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const style = isLayoutStyleId(record.style) ? record.style : undefined;
  const captions = typeof record.captions === "string" || record.captions === false ? record.captions : undefined;
  if (!style && typeof captions !== "string") return null;
  const media = Array.isArray(record.media)
    ? record.media.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        if (typeof row.key !== "string" || !(LAYOUT_MEDIA_ROLES as readonly string[]).includes(String(row.role))) return [];
        return [{ key: row.key, role: row.role as LayoutMediaRole, ...(typeof row.note === "string" && row.note ? { note: row.note } : {}) }];
      })
    : [];
  return {
    ...(style ? { style } : {}),
    ...(media.length ? { media } : {}),
    ...(captions !== undefined ? { captions } : {}),
    ...(record.status === "started" || record.status === "skipped" ? { status: record.status } : {}),
    ...(typeof record.videoId === "string" && record.videoId ? { videoId: record.videoId } : {}),
    ...(typeof record.reason === "string" && record.reason ? { reason: record.reason } : {}),
  };
};

/** The request alone, without what became of it, so a retried video finishes the same way. */
export const finishRequestOf = (stored: StoredFinish): PartnerFinish => ({
  ...(stored.style && isLayoutStyleId(stored.style) ? { style: stored.style } : {}),
  ...(stored.media?.length ? { media: stored.media } : {}),
  ...(stored.captions !== undefined ? { captions: stored.captions } : {}),
});

export interface FinishView {
  style: string | null;
  captions: string | false | null;
  status: "waiting" | "started" | "skipped";
  videoId: string | null;
  reason: string | null;
}

/** What a partner sees of the finish step, beside the base video. */
export const finishView = (stored: StoredFinish | null, jobStatus: string): FinishView | null => {
  if (!stored) return null;
  const base = { style: stored.style ?? null, captions: stored.captions ?? null };
  if (stored.status === "started") return { ...base, status: "started", videoId: stored.videoId ?? null, reason: null };
  if (stored.status === "skipped") return { ...base, status: "skipped", videoId: null, reason: stored.reason ?? null };
  if (jobStatus === "failed" || jobStatus === "canceled") {
    return { ...base, status: "skipped", videoId: null, reason: "The video didn't finish, so it wasn't styled." };
  }
  return { ...base, status: "waiting", videoId: null, reason: null };
};

/** What starting the follow-up takes. The webhook passes in the real queues. */
export interface FinishQueues {
  /** Lays the finished video out in a style. */
  layout: (
    userId: string,
    videoId: string,
    request: { style: string; media?: StoredFinish["media"]; showText: boolean; captionPreset?: string },
  ) => Promise<{ jobId: string }>;
  /** Draws captions into the finished video in a preset's look. */
  captions: (userId: string, videoId: string, preset: string) => Promise<{ jobId: string }>;
}

const SKIPPED_NO_CREDITS = "There weren't enough video credits left to style it, so the plain video was kept.";
const SKIPPED = "It couldn't be styled, so the plain video was kept.";

/** Plain reasons from the layout request are safe to pass on; anything else becomes the general one. */
const skipReason = (error: unknown) => {
  if (error instanceof InsufficientCreditsError) return SKIPPED_NO_CREDITS;
  if (error instanceof Error && error.name === "LayoutRequestError" && error.message.length < 200) {
    return `${error.message.replace(/\.$/, "")}, so the plain video was kept.`;
  }
  return SKIPPED;
};

/**
 * Starts the follow-up for a base video that just succeeded. A style takes the caption preset with
 * it; a caption preset alone gets a captions pass. A failure never touches the base video.
 */
export const runFinish = async (
  queues: FinishQueues,
  base: { userId: string; videoId: string; finish: StoredFinish },
): Promise<Pick<StoredFinish, "status" | "videoId" | "reason">> => {
  const { finish } = base;
  try {
    if (finish.style) {
      const queued = await queues.layout(base.userId, base.videoId, {
        style: finish.style,
        ...(finish.media?.length ? { media: finish.media } : {}),
        showText: finish.captions !== false,
        ...(typeof finish.captions === "string" ? { captionPreset: finish.captions } : {}),
      });
      return { status: "started", videoId: queued.jobId };
    }
    if (typeof finish.captions === "string") {
      const queued = await queues.captions(base.userId, base.videoId, finish.captions);
      return { status: "started", videoId: queued.jobId };
    }
    return { status: "skipped", reason: SKIPPED };
  } catch (error) {
    if (!(error instanceof InsufficientCreditsError) && !(error instanceof Error && error.name === "LayoutRequestError")) {
      console.error("Could not start the finish step", { videoId: base.videoId, error });
    }
    return { status: "skipped", reason: skipReason(error) };
  }
};

/** The general failure a partner's user sees. Credits always come back when a video fails. */
export const GENERIC_FAILURE = "Something went wrong making this video. Your credits were returned.";

/**
 * Failures a writer can act on, in plain words. Everything else is the general message, so no
 * internal step, model, or provider name ever reaches the partner's users.
 */
const USEFUL_FAILURES: readonly [RegExp, string][] = [
  [/no speech was found|nothing to caption|has no sound/i, "No speech was found in that video, so there was nothing to caption. Your credits were returned."],
  [/no picture to caption/i, "That file has no picture to caption. Your credits were returned."],
  [/pick a character with a picture|upload a photo of the speaker/i, "The character needs a picture first. Your credits were returned."],
  [/isn't in your library anymore|no file to lay out|no voice to lay out/i, "The video it was made from is gone, so it couldn't be made. Your credits were returned."],
  [/no words to say|write the words to say/i, "The script was empty. Your credits were returned."],
  [/moderat|content polic|safety (check|system|filter)|flagged|nsfw/i, "The picture or script was turned down by the safety check. Try a different picture or wording. Your credits were returned."],
  [/no face|face (wasn't|was not|could not be|couldn't be) (found|detected)/i, "No face was found in the picture. Use a clear, front-facing photo. Your credits were returned."],
];

/** A failed video's error, as the partner shows it. */
export const partnerFailureMessage = (error: string | null | undefined) => {
  if (!error) return GENERIC_FAILURE;
  for (const [pattern, message] of USEFUL_FAILURES) if (pattern.test(error)) return message;
  return GENERIC_FAILURE;
};

/** What a failed or canceled video becomes when it's tried again. */
export type RetryPlan =
  | { kind: "create"; input: PartnerVideoInput }
  | { kind: "layout"; videoId: string; style: string; media: StoredFinish["media"]; showText: boolean; captionPreset?: string }
  | { kind: "captions-finished"; videoId: string; preset: string };

const UPLOAD = /^uploads\//;

/**
 * Rebuilds a video's request from what its job kept, so trying again makes the same video with the
 * same finish. Null for a job a partner couldn't have started.
 */
export const retryPlanFor = (mode: string, input: JobInputFields, rawInput: unknown): RetryPlan | null => {
  const stored = readStoredFinish(rawInput);
  const finish = stored ? finishRequestOf(stored) : undefined;
  const format = input.format === "1:1" || input.format === "16:9" ? input.format : "9:16";
  const tier = input.tier === "low" || input.tier === "ultra" ? input.tier : "pro";
  const direction = input.visualDirection || undefined;
  if (mode === "ugc") {
    if (!input.characterId) return null;
    return {
      kind: "create",
      input: {
        kind: "ugc",
        characterId: input.characterId,
        ...(input.characterLookId ? { characterLookId: input.characterLookId } : {}),
        script: input.prompt,
        ...(UPLOAD.test(input.mediaKey) ? { productKey: input.mediaKey } : {}),
        ...(direction ? { direction } : {}),
        format,
        tier,
        captions: input.showText,
        ...(finish ? { finish } : {}),
      },
    };
  }
  if (mode === "avatar") {
    const photoKey = !input.characterId && UPLOAD.test(input.mediaKey) ? input.mediaKey : undefined;
    if (!input.characterId && !photoKey) return null;
    return {
      kind: "create",
      input: {
        kind: "avatar",
        ...(input.characterId ? { characterId: input.characterId } : {}),
        ...(input.characterLookId ? { characterLookId: input.characterLookId } : {}),
        ...(photoKey ? { photoKey } : {}),
        script: input.prompt,
        ...(direction ? { direction } : {}),
        format,
        tier,
        ...(finish ? { finish } : {}),
      },
    };
  }
  if (mode === "skit") {
    if (!input.characterId) return null;
    return {
      kind: "create",
      input: {
        kind: "skit",
        characterId: input.characterId,
        ...(input.characterLookId ? { characterLookId: input.characterLookId } : {}),
        script: input.prompt,
        // A retry keeps the look the skit asked for.
        look: skitLookOf(input.presetId) ?? "auto",
        ...(direction ? { direction } : {}),
        format,
        tier,
        ...(finish ? { finish } : {}),
      },
    };
  }
  if (mode === "voiceover") {
    return {
      kind: "create",
      input: {
        kind: "faceless",
        script: input.prompt,
        ...(input.characterId && input.characterId !== STUDIO_VOICE_ID ? { characterId: input.characterId } : {}),
        ...(direction ? { direction } : {}),
        format,
        tier,
      },
    };
  }
  if (mode === "captions") {
    if (input.captioning) return { kind: "captions-finished", videoId: input.captioning.sourceVideoId, preset: input.captioning.preset };
    if (!UPLOAD.test(input.mediaKey)) return null;
    return { kind: "create", input: { kind: "captions", videoKey: input.mediaKey } };
  }
  if (mode === LAYOUT_JOB_MODE && input.layout) {
    return {
      kind: "layout",
      videoId: input.layout.sourceVideoId,
      style: input.layout.style,
      media: input.layout.media.map((item) => ({ key: item.key, role: item.role, ...(item.note ? { note: item.note } : {}) })),
      showText: input.showText,
      ...(input.layout.captionPreset ? { captionPreset: input.layout.captionPreset } : {}),
    };
  }
  return null;
};

/**
 * What the finish step should cost, from how long the script will take to say. A style is priced
 * like a re-edit of a take that long; a caption look alone, like captioning it. The real price is
 * held when the step starts, from the finished video's own length.
 */
export const finishCredits = (script: string, finish: PartnerFinish, demo: boolean) => {
  const seconds = Math.max(MIN_VIDEO_LENGTH, scriptSize(script).seconds);
  const style = finish.style ? layoutStyleById(finish.style) : null;
  if (style) return layoutStyleCredits({ style, seconds, uploads: finish.media?.length ?? 0, demo });
  return videoJobCredits({ demo, mode: "captions", length: Math.max(MIN_VIDEO_LENGTH, Math.round(seconds)) });
};

/** A quote with a finish: the total, and the two parts it's made of. */
export const priceWithFinish = (video: number, finish: number) => ({ credits: video + finish, parts: { video, finish } });

/** Only a video that ended without a file can be tried again. */
export const canRetry = (status: string) => status === "failed" || status === "canceled";

/**
 * Reports a video that ended. A video that succeeded starts its finish step first, so the report
 * already names the video that follows; a finish that throws never stops the report.
 */
export const reportEnded = async (
  status: string,
  steps: { startFinish: () => Promise<void>; deliver: () => Promise<void> },
) => {
  if (status === "succeeded") {
    await steps.startFinish().catch((error) => console.error("Could not start the finish step", error));
  }
  await steps.deliver();
};
