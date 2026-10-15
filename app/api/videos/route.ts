import { z } from "zod";
import { auth } from "@/auth";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { videoJobCredits } from "@/lib/billing/estimate";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { isAudioKey, isImageKey, isMediaKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import { isGenerationModelAvailable } from "@/lib/video/available-models";
import { createQueuedVideoJob, listActiveVideoJobs } from "@/lib/video/jobs";
import { GENERATION_MODEL_IDS, generationModelById } from "@/lib/video/models";
import {
  defaultPromptForMode,
  modeNeedsUpload,
  resolveModeTier,
  VIDEO_MODE_IDS,
  VIDEO_TIERS,
} from "@/lib/video/modes";
import { resumeOpenVideos, startVideoJob } from "@/lib/video/worker";
import { MAX_PROMPT_LENGTH, MAX_REFERENCE_IMAGES, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH, VIDEO_FORMATS } from "@/lib/video/schema";

const CreateVideoSchema = z.object({
  prompt: z.string().trim().max(MAX_PROMPT_LENGTH).optional().default(""),
  format: z.enum(VIDEO_FORMATS),
  length: z.number().int().min(MIN_VIDEO_LENGTH).max(MAX_VIDEO_LENGTH),
  model: z.enum(GENERATION_MODEL_IDS).optional(),
  mode: z.enum(VIDEO_MODE_IDS).optional(),
  tier: z.enum(VIDEO_TIERS).optional(),
  imageKey: z.string().trim().min(1).max(200).optional(),
  mediaKey: z.string().trim().min(1).max(200).optional(),
  referenceKey: z.string().trim().min(1).max(200).optional(),
  referenceKeys: z.array(z.string().trim().min(1).max(200)).max(MAX_REFERENCE_IMAGES).optional(),
  showText: z.boolean().optional().default(true),
});

/**
 * Queues a video and returns immediately. The workflow engine does the work.
 * The browser reads progress from GET /api/videos/:id.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to generate videos." }, { status: 401 });

  const parsed = CreateVideoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const resolved = parsed.data.mode
    ? resolveModeTier(parsed.data.mode, parsed.data.tier ?? "")
    : null;
  if (parsed.data.mode && !parsed.data.tier) {
    return Response.json({ error: "Pick a quality tier." }, { status: 400 });
  }
  if (parsed.data.mode && !resolved) {
    return Response.json({ error: "This mode is coming soon." }, { status: 400 });
  }

  const mediaKey = parsed.data.mediaKey ?? parsed.data.imageKey;
  if (resolved && modeNeedsUpload(resolved.mode) && resolved.mode.upload !== "none") {
    const missing = missingUpload(resolved.mode.upload, userId, mediaKey);
    if (missing) return Response.json({ error: missing }, { status: 400 });
  }

  const prompt =
    parsed.data.prompt || (resolved?.mode.promptOptional ? defaultPromptForMode(resolved.mode) : "");
  if (prompt.length < 3) {
    return Response.json({ error: "Write a few words first." }, { status: 400 });
  }

  const videoModel = resolved ? resolved.model : parsed.data.model ? generationModelById(parsed.data.model) : null;
  const modelSlug = resolved?.chatModel ?? videoModel?.slug;
  if (!modelSlug) return Response.json({ error: "Pick a generation model and try again." }, { status: 400 });
  if (videoModel && !isGenerationModelAvailable(videoModel)) {
    return Response.json({ error: `${videoModel.name} isn't set up on this server. Pick another model.` }, { status: 400 });
  }
  if (videoModel && !videoModel.aspectRatios.includes(parsed.data.format)) {
    const formats = new Intl.ListFormat("en", { type: "disjunction" }).format(
      VIDEO_FORMATS.filter((format) => videoModel.aspectRatios.includes(format)),
    );
    return Response.json({ error: `${videoModel.name} only films ${formats} video.` }, { status: 400 });
  }

  const referenceKeys = parsed.data.mode
    ? []
    : [...new Set([...(parsed.data.referenceKeys ?? []), ...(parsed.data.referenceKey ? [parsed.data.referenceKey] : [])])].slice(
        0,
        MAX_REFERENCE_IMAGES,
      );
  if (referenceKeys.length > 0) {
    const invalid = referenceKeys.some((key) => !isOwnedUploadKey(userId, key) || !isImageKey(key));
    if (invalid) {
      return Response.json({ error: "Upload a reference picture." }, { status: 400 });
    }
    if (!videoModel?.referenceImages) {
      return Response.json({ error: "This model can't use a reference picture." }, { status: 400 });
    }
  }

  try {
    const credits = videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: resolved?.mode.id,
      tier: resolved?.tier,
      modelId: videoModel?.id,
      modelSlug: videoModel?.slug ?? modelSlug,
      resolution: resolved?.resolution,
      length: parsed.data.length,
    });
    const job = await createQueuedVideoJob(userId, {
      prompt,
      format: parsed.data.format,
      length: parsed.data.length,
      model: modelSlug,
      mode: resolved?.mode.id,
      tier: resolved?.tier,
      resolution: resolved?.resolution,
      mediaKey: resolved && modeNeedsUpload(resolved.mode) ? mediaKey : undefined,
      imageKey: resolved && modeNeedsUpload(resolved.mode) ? mediaKey : undefined,
      referenceKeys: referenceKeys.length > 0 ? referenceKeys : undefined,
      showText: parsed.data.showText,
      creditsHeld: credits,
    });
    void startVideoJob(userId, job.id).catch((error) => {
      console.error("Video stopped", error);
    });
    return Response.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    console.error("Could not start the video", error);
    return Response.json({ error: "Couldn't start the video. Try again." }, { status: 500 });
  }
}

const missingUpload = (kind: "image" | "audio" | "video" | "media", userId: string, key?: string) => {
  if (!key || !isOwnedUploadKey(userId, key)) {
    if (kind === "image") return "Upload a starting picture.";
    if (kind === "audio") return "Upload a song.";
    if (kind === "video") return "Upload a video.";
    return "Upload an audio or video file.";
  }
  if (kind === "image" && !isImageKey(key)) return "Upload a starting picture.";
  if (kind === "audio" && !isAudioKey(key)) return "Upload a song.";
  if (kind === "video" && !isVideoKey(key)) return "Upload a video.";
  if (kind === "media" && !isMediaKey(key)) return "Upload an audio or video file.";
  return null;
};

/** Active jobs for the signed-in user, so a fresh page can pick them up. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see your videos." }, { status: 401 });

  const status = new URL(request.url).searchParams.get("status");
  if (status !== "active") {
    return Response.json({ error: "Pass status=active." }, { status: 400 });
  }

  const jobs = await listActiveVideoJobs(userId);
  if (jobs.length > 0) {
    void resumeOpenVideos(userId).catch((error) => {
      console.error("Could not resume videos", error);
    });
  }
  return Response.json({ jobs });
}
