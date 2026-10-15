import "server-only";
import { FPS } from "@/lib/video/schema";
import { getAdapters, type AdapterJob, type AdapterRequest, type AdapterRef } from "../adapters";
import { readProductionBytes, saveProductionBytes } from "../assets";
import { saveFilmstrip } from "../filmstrip";
import { compileImagePrompt, compileShotPrompt } from "../compile";
import { defaultImageCapability, defaultVideoCapability } from "../capabilities";
import { prettyTarget, REVIEW_REJECTED } from "../progress";
import { captureBoundaryFrames, type BoundaryFrames } from "../review/frames";
import { assembleClips, assetsByStep, videoForShot } from "./assemble";
import { applyExtension, decideSubmit } from "./idempotency";
import { MAX_STILL_REFERENCES, referencePictures, referencePrompt } from "../references";
import type { CreativeBrief, InputRecord, Observation, Shot } from "../schema";
import { getUpload, hasS3Config } from "@/lib/storage/s3";
import {
  addUsage,
  currentEntityData,
  finishStep,
  latestJobForStep,
  listAssets,
  listSteps,
  putEntity,
  saveAsset,
  saveGenerationJob,
  updateGenerationJob,
  updateProduction,
} from "../store";
import { openEditorProjectForProduction } from "../editor";
import { loadBrief, loadStructure } from "./coordinator";
import { db } from "@/lib/db";

const assetKindFor = (mime: string): "image" | "audio" | "video" => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "video";
};

const persistOutput = async (
  userId: string,
  productionId: string,
  jobId: string,
  output: { mime: string; bytes?: Uint8Array },
) => {
  if (!output.bytes) return null;
  const assetId = crypto.randomUUID();
  const saved = await saveProductionBytes(userId, productionId, assetId, output.bytes, output.mime);
  if (assetKindFor(output.mime) === "video") {
    try {
      await saveFilmstrip(saved.key, output.bytes);
    } catch (error) {
      console.error("Could not build a filmstrip. The timeline will build it on first view.", error);
    }
  }
  return saveAsset({
    productionId,
    storageKey: saved.key,
    kind: assetKindFor(output.mime),
    mime: output.mime,
    sha256: saved.sha256,
    probe: { bytes: output.bytes.byteLength },
    producedByJobId: jobId,
    inputVersionIds: [],
    status: "accepted",
  });
};

/** Stores a clip's exact final frame as a helper asset the next clip can start from. */
const persistLastFrame = async (
  userId: string,
  productionId: string,
  frame: BoundaryFrames["last"],
  source: { shotId: string; videoAssetId: string },
) => {
  const assetId = crypto.randomUUID();
  const saved = await saveProductionBytes(userId, productionId, assetId, frame.bytes, frame.mime);
  return saveAsset({
    productionId,
    storageKey: saved.key,
    kind: "image",
    mime: frame.mime,
    sha256: saved.sha256,
    probe: { bytes: frame.bytes.byteLength, role: "last_frame", timeSec: frame.timeSec, ...source },
    inputVersionIds: [],
    status: "derived",
  });
};

const toRef = (role: AdapterRef["role"], bytes: Uint8Array, mime: string): AdapterRef => ({
  role,
  mime,
  bytes,
  url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
});

/** The job record keeps sizes instead of binary payloads, so it stays small and readable. */
const requestForRecord = (request: AdapterRequest) => ({
  ...request,
  refs: request.refs?.map((ref) => ({ role: ref.role, mime: ref.mime, bytes: ref.bytes?.byteLength ?? 0 })),
  frames: request.frames?.map((frame) => ({ timeSec: frame.timeSec, mime: frame.mime, bytes: frame.bytes.byteLength })),
  audioBytes: request.audioBytes?.byteLength,
  videoBytes: request.videoBytes?.byteLength,
});

const runAdapter = async (args: {
  productionId: string;
  stepId: string;
  adapter: ReturnType<typeof getAdapters>[keyof ReturnType<typeof getAdapters>];
  request: AdapterRequest;
  idempotencyKey: string;
}): Promise<AdapterJob & { localJobId?: string }> => {
  const existing = await latestJobForStep(args.stepId);
  if (existing?.status === "completed") {
    return {
      providerJobId: existing.providerJobId ?? existing.id,
      status: "completed" as const,
      outputs: [],
      usage: { usd: 0, units: {} },
      localJobId: existing.id,
    };
  }
  const decision = existing
    ? decideSubmit({ status: existing.status, providerJobId: existing.providerJobId })
    : "submit";
  if (decision === "needs_reconcile") {
    if (existing) {
      await updateGenerationJob(existing.id, { status: "needs_reconcile" });
    }
    throw new Error("This job was interrupted while submitting. Confirm it before paying again.");
  }
  if (decision === "poll" && existing?.providerJobId) {
    const polled = await args.adapter.poll(existing.providerJobId);
    if (polled.status === "completed") {
      const collected = await args.adapter.collect(existing.providerJobId);
      await updateGenerationJob(existing.id, {
        status: "completed",
        outputs: collected.outputs.map((output) => ({ mime: output.mime, hasBytes: Boolean(output.bytes) })),
        completedAt: new Date(),
      });
      return { ...collected, localJobId: existing.id };
    }
    if (polled.status === "failed") throw new Error(polled.error ?? "The provider job failed.");
    await finishStep(args.stepId, "waiting_provider");
    return polled;
  }

  const job = await saveGenerationJob({
    productionId: args.productionId,
    stepId: args.stepId,
    provider: args.adapter.id,
    route: args.adapter.id,
    modelId: args.request.modelId,
    request: requestForRecord(args.request),
    status: "submitting",
    estimatedUsd: args.adapter.estimate(args.request),
  });
  const submitted = await args.adapter.submit(args.request, args.idempotencyKey);
  await updateGenerationJob(job.id, {
    status: submitted.status === "completed" ? "completed" : "in_progress",
    providerJobId: submitted.providerJobId,
    outputs: submitted.outputs.map((output) => ({ mime: output.mime, hasBytes: Boolean(output.bytes) })),
    usage: submitted.usage,
    actualUsd: submitted.usage.usd,
    interactionContext: submitted.interactionContext,
    submittedAt: new Date(),
    completedAt: submitted.status === "completed" ? new Date() : undefined,
  });
  await addUsage(args.productionId, job.id, args.adapter.id, args.request.modelId, submitted.usage.usd, submitted.usage.units);
  return { ...submitted, localJobId: job.id };
};

export const executeStep = async (userId: string, productionId: string, step: { id: string; kind: string; targetKey: string; idempotencyKey: string }) => {
  const adapters = getAdapters();
  const structure = await loadStructure(productionId);
  const brief = (await loadBrief(productionId)) ?? fallbackBrief();
  const finishIfCurrent = async (status: Parameters<typeof finishStep>[1], error?: string | null) => {
    const current = await db.productionStep.findUnique({
      where: { id: step.id },
      select: { idempotencyKey: true },
    });
    if (current?.idempotencyKey !== step.idempotencyKey) return;
    await finishStep(step.id, status, error);
  };

  if (step.kind === "reference_image") {
    const subject = await subjectFor(productionId, step.targetKey, structure, brief);
    const production = await db.production.findUnique({ where: { id: productionId } });
    const userRefs = await userReferenceRefs(productionId);
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter: adapters.image,
      request: {
        modelId: defaultImageCapability(true).modelId,
        prompt: referencePrompt(subject, userRefs.length),
        format: production?.format,
        refs: userRefs.length > 0 ? userRefs : undefined,
      },
      idempotencyKey: step.idempotencyKey,
    });
    await saveFirstOutput(userId, productionId, result);
    await finishIfCurrent(result.status === "completed" ? "succeeded" : "waiting_provider");
    return;
  }

  if (step.kind === "speech") {
    const id = step.targetKey.replace(/^speech:/, "");
    const segment = structure?.audioSegments.find((entry) => entry.id === id);
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter: adapters.speech,
      request: {
        modelId: "eleven_multilingual_v2",
        prompt: segment?.text ?? "",
        text: segment?.text ?? "",
        voiceId: segment?.voiceId ?? "maya-en",
        durationSec: segment?.durationSec,
      },
      idempotencyKey: step.idempotencyKey,
    });
    const asset = await saveFirstOutput(userId, productionId, result);
    if (segment && result.status === "completed") {
      const duration = Number((result.outputs[0]?.json as { durationSec?: number } | undefined)?.durationSec ?? segment.durationSec);
      await putEntity(productionId, "audio_segment", segment.id, { ...segment, measuredDurationSec: duration }, "observed", step.id);
      const shot = structure?.shots.find((entry) => entry.id === segment.shotIds[0]);
      if (shot && duration > shot.editDurationSec) {
        await putEntity(productionId, "shot", shot.id, { ...shot, editDurationSec: duration, generationDurationSec: duration }, "system", step.id);
      }
    }
    void asset;
    await finishIfCurrent(result.status === "completed" ? "succeeded" : "waiting_provider");
    return;
  }

  if (step.kind === "shot_video") {
    const shotId = step.targetKey.replace(/^shot:/, "");
    const shot = structure?.shots.find((entry) => entry.id === shotId);
    if (!shot) throw new Error("Missing shot.");
    const scene = structure?.scenes.find((entry) => entry.id === shot.sceneId);
    const observation = shot.dependsOn
      ? await currentEntityData<Observation>(productionId, "observation", shot.dependsOn)
      : null;
    const previousTake = await currentEntityData<Observation>(productionId, "observation", shot.id);
    const prompt = compileShotPrompt({
      corrections: previousTake
        ? [...previousTake.deviations, ...previousTake.incompleteActions.map((action) => `not completed: ${action}`)]
        : [],
      brief,
      scene: scene ?? {
        id: shot.sceneId,
        scriptSceneId: shot.sceneId,
        locationId: "",
        characterIds: shot.characterIds,
        time: "",
        weather: "",
        lighting: "",
        layout: "",
        props: [],
        emotionalSituation: shot.emotionalArc,
        purpose: shot.purpose,
      },
      shot,
      observation,
      characterNotes: (structure?.characters ?? [])
        .filter((character) => shot.characterIds.includes(character.id))
        .map((character) => `${character.name}: ${character.appearance}, ${character.clothing}`),
      locationNotes: structure?.locations.find((location) => location.id === scene?.locationId)?.description ?? "",
    });
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter: adapters.video,
      request: {
        modelId: defaultVideoCapability().modelId,
        prompt,
        durationSec: shot.generationDurationSec,
        format: (await db.production.findUnique({ where: { id: productionId } }))?.format,
        refs: await shotStartRefs(productionId, shot, observation),
        interactionContext: shot.continuity === "continue_shot" ? observation : undefined,
      },
      idempotencyKey: step.idempotencyKey,
    });
    const previous = (await listAssets(productionId))
      .filter((asset) => asset.kind === "video" && asset.status === "accepted")
      .map((asset) => asset.id);
    const saved = await saveFirstOutput(userId, productionId, result);
    if (result.status === "completed" && !saved && !(await shotFootage(productionId, shot.id))) {
      throw new Error("The video model finished without returning a clip.");
    }
    if (saved && result.extensionSpan === "full") {
      const applied = applyExtension(previous, saved.id, "full");
      if (applied.replace.length > 0) {
        await db.productionAsset.updateMany({
          where: { id: { in: applied.replace } },
          data: { status: "alternate" },
        });
      }
    }
    await finishIfCurrent(result.status === "completed" ? "succeeded" : "waiting_provider");
    return;
  }

  if (step.kind === "lipsync") {
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter: adapters.lipsync,
      request: {
        modelId: "sync-3",
        prompt: "lipsync",
        syncMode: "cut_off",
      },
      idempotencyKey: step.idempotencyKey,
    });
    await saveFirstOutput(userId, productionId, result);
    await finishIfCurrent(result.status === "completed" ? "succeeded" : "waiting_provider");
    return;
  }

  if (step.kind === "review_shot") {
    const shotId = step.targetKey.replace(/^shot:/, "");
    const shot = structure?.shots.find((entry) => entry.id === shotId);
    const footage = shot ? await shotFootage(productionId, shot.id) : null;
    if (!footage) throw new Error(`There is no footage to review for ${prettyTarget(step.targetKey)}.`);
    const frames = await boundaryFramesFor(footage.bytes);
    const lastFrameAsset =
      frames && footage && shot ? await persistLastFrame(userId, productionId, frames.last, { shotId: shot.id, videoAssetId: footage.assetId }) : null;
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter: adapters.review,
      request: {
        modelId: "gemini-3.8-flash",
        prompt: `Shot plan and creative brief:\n${JSON.stringify({ shot, brief })}`,
        frames: frames?.sampled,
        refs: frames ? [toRef("last_frame", frames.last.bytes, frames.last.mime)] : undefined,
      },
      idempotencyKey: step.idempotencyKey,
    });
    const json = result.outputs[0]?.json as
      | {
          passed?: boolean;
          findings?: unknown;
          observation?: Partial<Observation>;
        }
      | undefined;
    if (json?.observation && shot) {
      await putEntity(
        productionId,
        "observation",
        shot.id,
        {
          shotId: shot.id,
          assetId: footage?.assetId ?? "",
          outgoingEditSec: shot.editDurationSec,
          completedActions: json.observation.completedActions ?? [],
          incompleteActions: json.observation.incompleteActions ?? [],
          deviations: json.observation.deviations ?? [],
          boundaryOut: json.observation.boundaryOut ?? shot.boundaryOut,
          lastFrameAssetId: lastFrameAsset?.id ?? null,
          lastFrameDescription: lastFrameAsset ? (json.observation.lastFrameDescription ?? "") : "",
        } satisfies Observation,
        "observed",
        step.id,
      );
    }
    const rejected = json?.passed === false;
    await finishIfCurrent(result.status === "failed" || rejected ? "failed" : "succeeded", rejected ? REVIEW_REJECTED : null);
    if (rejected) {
      await updateProduction(productionId, {
        status: "failed",
        error: `The review rejected ${prettyTarget(step.targetKey)}. Retry to film it again.`,
      });
    }
    return;
  }

  if (step.kind === "music" || step.kind === "ambience" || step.kind === "sfx") {
    const adapter = step.kind === "music" ? adapters.music : adapters.sfx;
    const id = step.targetKey.split(":")[1] ?? "";
    const segment = structure?.audioSegments.find((entry) => entry.id === id);
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter,
      request: {
        modelId: step.kind === "music" ? "music_v2_5" : "eleven_text_to_sound_v2",
        prompt: segment?.prompt ?? step.kind,
        durationSec: segment?.durationSec,
      },
      idempotencyKey: step.idempotencyKey,
    });
    await saveFirstOutput(userId, productionId, result);
    await finishIfCurrent(result.status === "completed" ? "succeeded" : "waiting_provider");
    return;
  }

  if (step.kind === "assemble") {
    const production = await db.production.findUnique({ where: { id: productionId } });
    if (!production) throw new Error("Missing production.");
    const assets = (await listAssets(productionId)).filter((asset) => asset.status === "accepted");
    const jobs = await db.generationJob.findMany({ where: { productionId }, select: { id: true, stepId: true, providerJobId: true } });
    const steps = await listSteps(productionId);
    const clips = assembleClips(structure, assetsByStep(assets, jobs, steps));
    const durationSec = clips.reduce((end, clip) => Math.max(end, clip.startSec + clip.durationSec), 0);
    const dims = production.format === "16:9" ? { width: 1920, height: 1080 } : production.format === "1:1" ? { width: 1080, height: 1080 } : { width: 1080, height: 1920 };
    await putEntity(
      productionId,
      "timeline",
      "timeline",
      { fps: FPS, width: dims.width, height: dims.height, clips, durationSec },
      "system",
      step.id,
    );
    await openEditorProjectForProduction(userId, productionId);
    await finishIfCurrent("succeeded");
    return;
  }

  if (step.kind === "final_review") {
    await finishIfCurrent("succeeded");
    return;
  }

  if (step.kind === "export") {
    await openEditorProjectForProduction(userId, productionId);
    await updateProduction(productionId, { status: "ready", stage: "done" });
    await finishIfCurrent("succeeded");
    return;
  }

  await finishIfCurrent("succeeded");
};

/**
 * The image a clip starts from. A continuation starts on the predecessor's exact final frame;
 * anything else (or a missing frame) falls back to the shot's storyboard still.
 */
/** Pictures the user attached when starting the production, read back for the still-image model. */
const userReferenceRefs = async (productionId: string): Promise<AdapterRef[]> => {
  const input = await currentEntityData<InputRecord>(productionId, "input", "input");
  const pictures = referencePictures(input).slice(0, MAX_STILL_REFERENCES);
  if (pictures.length === 0 || !hasS3Config()) return [];
  const refs: AdapterRef[] = [];
  for (const picture of pictures) {
    try {
      const { bytes, contentType } = await getUpload(picture.key);
      if (bytes.byteLength > 0) refs.push(toRef("subject_ref", bytes, contentType));
    } catch (error) {
      console.warn(`Reference picture ${picture.key} could not be read.`, error);
    }
  }
  return refs;
};

const shotStartRefs = async (productionId: string, shot: Shot, observation: Observation | null): Promise<AdapterRef[]> => {
  if (shot.continuity === "continue_shot" && observation?.lastFrameAssetId) {
    const lastFrame = await previousLastFrameRef(productionId, observation.lastFrameAssetId);
    if (lastFrame) return [lastFrame];
    console.warn(`Shot ${shot.id}: the predecessor's last frame is missing. Falling back to the storyboard still.`);
  }
  return shotStillRef(productionId, shot.id);
};

const previousLastFrameRef = async (productionId: string, assetId: string): Promise<AdapterRef | null> => {
  const asset = (await listAssets(productionId)).find((entry) => entry.id === assetId && entry.kind === "image");
  if (!asset) return null;
  const { bytes, contentType } = await readProductionBytes(asset.storageKey);
  if (bytes.byteLength < 1000) return null;
  return toRef("first_frame", bytes, contentType);
};

const shotStillRef = async (productionId: string, shotId: string): Promise<AdapterRef[]> => {
  const stillStep = (await listSteps(productionId)).find(
    (entry) => entry.kind === "reference_image" && entry.targetKey === `shot:${shotId}`,
  );
  if (!stillStep) return [];
  const job = await latestJobForStep(stillStep.id);
  if (!job) return [];
  const asset = (await listAssets(productionId)).find(
    (entry) => entry.producedByJobId === job.id && entry.kind === "image" && entry.status === "accepted",
  );
  if (!asset) return [];
  const { bytes, contentType } = await readProductionBytes(asset.storageKey);
  if (bytes.byteLength < 1000) return [];
  return [toRef("first_frame", bytes, contentType)];
};

/** The footage currently standing in for a shot, read from storage. */
const shotFootage = async (productionId: string, shotId: string) => {
  const assets = (await listAssets(productionId)).filter((asset) => asset.status === "accepted");
  const jobs = await db.generationJob.findMany({ where: { productionId }, select: { id: true, stepId: true, providerJobId: true } });
  const steps = await listSteps(productionId);
  const video = videoForShot(shotId, assetsByStep(assets, jobs, steps));
  const asset = video ? assets.find((entry) => entry.id === video.id) : undefined;
  if (!asset) return null;
  const { bytes } = await readProductionBytes(asset.storageKey);
  return { assetId: asset.id, bytes };
};

/** Frame capture must never sink a review; without frames the reviewer works from the plan and says so. */
const boundaryFramesFor = async (video: Uint8Array): Promise<BoundaryFrames | null> => {
  try {
    return await captureBoundaryFrames(video);
  } catch (error) {
    console.error("Could not capture the clip's boundary frames. The review will run without them.", error);
    return null;
  }
};

const saveFirstOutput = async (userId: string, productionId: string, result: AdapterJob & { localJobId?: string }) => {
  const output = result.outputs.find((entry) => entry.bytes);
  if (!output?.bytes) return null;
  return persistOutput(userId, productionId, result.localJobId ?? result.providerJobId, output);
};

const subjectFor = async (
  productionId: string,
  targetKey: string,
  structure: Awaited<ReturnType<typeof loadStructure>>,
  brief: CreativeBrief,
) => {
  void productionId;
  if (targetKey.startsWith("character:")) {
    const character = structure?.characters.find((entry) => entry.id === targetKey.slice(10));
    return compileImagePrompt(`${character?.name ?? "character"}. ${character?.appearance}. ${character?.clothing}`, brief);
  }
  if (targetKey.startsWith("location:")) {
    const location = structure?.locations.find((entry) => entry.id === targetKey.slice(9));
    return compileImagePrompt(location?.description ?? "location", brief);
  }
  const shot = structure?.shots.find((entry) => entry.id === targetKey.slice(5));
  return compileImagePrompt(shot?.intendedBeginning ?? "storyboard frame", brief);
};

const fallbackBrief = (): CreativeBrief => ({
  visualStyle: "Naturalistic",
  colorPalette: "Muted",
  lighting: "Practical",
  texture: "Lived-in",
  cameraBehavior: "Restrained",
  performanceStyle: "Subtle",
  pacing: "Measured",
  music: "Sparse",
  ambience: "Quiet",
  emotionalProgression: "Rising tension",
  summary: "Naturalistic suspense with muted colors.",
});
