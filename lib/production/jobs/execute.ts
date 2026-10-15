import "server-only";
import { FPS } from "@/lib/video/schema";
import { getAdapters, type AdapterJob, type AdapterRequest } from "../adapters";
import { saveProductionBytes } from "../assets";
import { compileImagePrompt, compileShotPrompt } from "../compile";
import { defaultImageCapability, defaultVideoCapability } from "../capabilities";
import { applyExtension, decideSubmit } from "./idempotency";
import type { CreativeBrief, Observation } from "../schema";
import {
  addUsage,
  currentEntityData,
  finishStep,
  latestJobForStep,
  listAssets,
  putEntity,
  saveAsset,
  saveGenerationJob,
  updateGenerationJob,
  updateProduction,
} from "../store";
import { compileToEditorTimeline } from "../timeline";
import { loadBrief, loadStructure } from "./coordinator";
import { db } from "@/lib/db";

const assetKindFor = (mime: string) => {
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

const runAdapter = async (args: {
  productionId: string;
  stepId: string;
  adapter: ReturnType<typeof getAdapters>[keyof ReturnType<typeof getAdapters>];
  request: AdapterRequest;
  idempotencyKey: string;
}) => {
  const existing = await latestJobForStep(args.stepId);
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
    if (polled.status === "completed") return args.adapter.collect(existing.providerJobId);
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
    request: args.request,
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

  if (step.kind === "reference_image") {
    const subject = await subjectFor(productionId, step.targetKey, structure, brief);
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter: adapters.image,
      request: { modelId: defaultImageCapability(true).modelId, prompt: subject },
      idempotencyKey: step.idempotencyKey,
    });
    await saveFirstOutput(userId, productionId, result);
    await finishStep(step.id, result.status === "completed" ? "succeeded" : "waiting_provider");
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
        modelId: "eleven_v4",
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
    await finishStep(step.id, result.status === "completed" ? "succeeded" : "waiting_provider");
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
    const prompt = compileShotPrompt({
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
        interactionContext: shot.continuity === "continue_shot" ? observation : undefined,
      },
      idempotencyKey: step.idempotencyKey,
    });
    const previous = (await listAssets(productionId)).filter((asset) => asset.kind === "video").map((asset) => asset.id);
    const saved = await saveFirstOutput(userId, productionId, result);
    if (saved && result.extensionSpan === "full") {
      const applied = applyExtension(previous, saved.id, "full");
      if (applied.replace.length > 0) {
        await db.productionAsset.updateMany({
          where: { id: { in: applied.replace } },
          data: { status: "alternate" },
        });
      }
    }
    await finishStep(step.id, result.status === "completed" ? "succeeded" : "waiting_provider");
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
    await finishStep(step.id, result.status === "completed" ? "succeeded" : "waiting_provider");
    return;
  }

  if (step.kind === "review_shot") {
    const shotId = step.targetKey.replace(/^shot:/, "");
    const shot = structure?.shots.find((entry) => entry.id === shotId);
    const result = await runAdapter({
      productionId,
      stepId: step.id,
      adapter: adapters.review,
      request: { modelId: "gemini-3.8-flash", prompt: JSON.stringify({ shot, brief }) },
      idempotencyKey: step.idempotencyKey,
    });
    const json = result.outputs[0]?.json as
      | {
          passed?: boolean;
          findings?: unknown;
          observation?: Observation;
        }
      | undefined;
    if (json?.observation && shot) {
      await putEntity(
        productionId,
        "observation",
        shot.id,
        {
          shotId: shot.id,
          assetId: "",
          outgoingEditSec: shot.editDurationSec,
          completedActions: json.observation.completedActions ?? [],
          incompleteActions: json.observation.incompleteActions ?? [],
          deviations: json.observation.deviations ?? [],
          boundaryOut: json.observation.boundaryOut ?? shot.boundaryOut,
        },
        "observed",
        step.id,
      );
    }
    await finishStep(step.id, result.status === "failed" || json?.passed === false ? "failed" : "succeeded", json?.passed === false ? "Review rejected the shot." : null);
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
        compositionPlan: step.kind === "music" ? { sections: [{ prompt: segment?.prompt }] } : undefined,
      },
      idempotencyKey: step.idempotencyKey,
    });
    await saveFirstOutput(userId, productionId, result);
    await finishStep(step.id, result.status === "completed" ? "succeeded" : "waiting_provider");
    return;
  }

  if (step.kind === "assemble") {
    const production = await db.production.findUnique({ where: { id: productionId } });
    if (!production) throw new Error("Missing production.");
    const assets = await listAssets(productionId);
    const clips = assembleClips(structure, assets);
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
    compileToEditorTimeline(
      { fps: FPS, width: dims.width, height: dims.height, clips, durationSec },
      production.format as "9:16" | "16:9" | "1:1",
      assets.map((asset) => ({ id: asset.id, kind: asset.kind as "video" | "audio" | "image", name: asset.id })),
    );
    await finishStep(step.id, "succeeded");
    return;
  }

  if (step.kind === "final_review") {
    await finishStep(step.id, "succeeded");
    return;
  }

  if (step.kind === "export") {
    await updateProduction(productionId, { status: "ready", stage: "done" });
    await finishStep(step.id, "succeeded");
    return;
  }

  await finishStep(step.id, "succeeded");
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

const assembleClips = (
  structure: Awaited<ReturnType<typeof loadStructure>>,
  assets: { id: string; kind: string }[],
) => {
  const videos = assets.filter((asset) => asset.kind === "video");
  const audios = assets.filter((asset) => asset.kind === "audio");
  const clips = [];
  let cursor = 0;
  for (const [index, shot] of (structure?.shots ?? []).entries()) {
    const video = videos[index];
    if (video) {
      clips.push({
        id: `clip_${shot.id}`,
        shotId: shot.id,
        assetId: video.id,
        kind: "video" as const,
        startSec: cursor,
        durationSec: shot.editDurationSec,
        trimInSec: 0,
        trimOutSec: shot.editDurationSec,
        volume: 0,
        fadeInSec: 0,
        fadeOutSec: 0,
        transition: "cut" as const,
      });
    }
    cursor += shot.editDurationSec;
  }
  let audioIndex = 0;
  for (const segment of structure?.audioSegments ?? []) {
    const audio = audios[audioIndex];
    audioIndex += 1;
    if (!audio) continue;
    const firstShot = structure?.shots.find((shot) => shot.id === segment.shotIds[0]);
    const start = (structure?.shots ?? [])
      .filter((shot) => shot.order < (firstShot?.order ?? 0))
      .reduce((sum, shot) => sum + shot.editDurationSec, 0);
    clips.push({
      id: `clip_${segment.id}`,
      shotId: firstShot?.id ?? null,
      assetId: audio.id,
      kind: "audio" as const,
      startSec: start + segment.startOffsetSec,
      durationSec: segment.measuredDurationSec ?? segment.durationSec,
      trimInSec: 0,
      trimOutSec: segment.durationSec,
      volume: segment.track === "music" ? 0.35 : 1,
      fadeInSec: segment.fadeInSec,
      fadeOutSec: segment.fadeOutSec,
      transition: null,
    });
  }
  return clips;
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
