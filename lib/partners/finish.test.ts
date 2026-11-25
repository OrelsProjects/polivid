import assert from "node:assert/strict";
import test from "node:test";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { layoutStyleCredits, videoJobCredits } from "@/lib/billing/estimate";
import { readJobInput } from "@/lib/video/job-status";
import { scriptSize } from "@/lib/video/script-markup";
import { restyleCaptionsInPlace } from "@/lib/editor/caption-presets";
import { readCaptioning } from "@/lib/video/captions";
import { buildCaptionedTimeline } from "@/lib/video/compose/timeline";
import { layoutStyleById, readLayoutSettings, styleNeedsProblem } from "@/lib/video/layout/styles";
import {
  canRetry,
  finishCredits,
  finishView,
  GENERIC_FAILURE,
  partnerFailureMessage,
  priceWithFinish,
  readStoredFinish,
  reportEnded,
  retryPlanFor,
  runFinish,
  storedFinishFrom,
  type FinishQueues,
} from "./finish";
import { partnerVideoOptions } from "./options";
import { FinishSchema, PartnerVideoSchema } from "./video-request";

const CHARACTER = "00000000-0000-4000-8000-000000000001";
const VIDEO = "00000000-0000-4000-8000-0000000000aa";

test("a finish takes a style, a caption style, or both, and nothing unknown", () => {
  assert.ok(FinishSchema.safeParse({ style: "punch-in" }).success);
  assert.ok(FinishSchema.safeParse({ captions: "yellow-pop" }).success);
  assert.ok(FinishSchema.safeParse({ style: "split-presenter", captions: false }).success);
  assert.ok(FinishSchema.safeParse({ style: "source-reader", media: [{ key: "uploads/u/post.png", role: "post" }], captions: "karaoke" }).success);
  assert.equal(FinishSchema.safeParse({}).success, false, "empty");
  assert.equal(FinishSchema.safeParse({ captions: false }).success, false, "no captions and no style does nothing");
  assert.equal(FinishSchema.safeParse({ captions: "comic-sans" }).success, false, "unknown caption style");
  assert.equal(FinishSchema.safeParse({ style: "wobble" }).success, false, "unknown style");
  assert.equal(FinishSchema.safeParse({ style: "punch-in", music: true }).success, false, "unknown field");
  assert.equal(FinishSchema.safeParse({ captions: "bold-caps", media: [{ key: "uploads/u/a.png", role: "picture" }] }).success, false, "uploads need a style");
});

test("only UGC ads and talking avatars take a finish", () => {
  const finish = { style: "punch-in", captions: "yellow-pop" };
  const ugc = PartnerVideoSchema.parse({ kind: "ugc", characterId: CHARACTER, script: "Try this today.", finish });
  assert.deepEqual(ugc.kind === "ugc" && ugc.finish, finish);
  assert.ok(PartnerVideoSchema.safeParse({ kind: "avatar", characterId: CHARACTER, script: "Hello there.", finish }).success);
  assert.equal(PartnerVideoSchema.safeParse({ kind: "faceless", script: "One line. Another.", finish }).success, false);
  assert.equal(PartnerVideoSchema.safeParse({ kind: "captions", videoKey: "uploads/u/v.mp4", finish }).success, false);
});

test("a style that needs an upload refuses to run without one", () => {
  const reader = layoutStyleById("source-reader")!;
  assert.match(styleNeedsProblem(reader, []) ?? "", /Source reader needs a post/);
  assert.equal(styleNeedsProblem(reader, [{ role: "post" }]), null);
  assert.match(styleNeedsProblem(layoutStyleById("screen-demo")!, [{ role: "picture" }]) ?? "", /a recording or a screenshot/);
  assert.equal(styleNeedsProblem(layoutStyleById("punch-in")!, []), null);
});

test("a quote with a finish adds the two parts, and the finish is priced from the script's length", () => {
  const script = "Here is the thing nobody tells you about writing every day. It compounds. Start small, keep going.";
  const seconds = Math.max(2, scriptSize(script).seconds);
  const style = finishCredits(script, { style: "punch-in" }, false);
  assert.ok(style > 0);
  assert.equal(style, layoutStyleCredits({ style: layoutStyleById("punch-in")!, seconds, uploads: 0 }));
  // An upload stands in for a picture that would have been drawn, so it never costs more.
  assert.ok(finishCredits(script, { style: "split-presenter", media: [{ key: "uploads/u/a.png", role: "picture" }] }, false) <= finishCredits(script, { style: "split-presenter" }, false));
  assert.equal(finishCredits(script, { captions: "bold-caps" }, false), videoJobCredits({ mode: "captions", length: Math.round(seconds) }));
  assert.equal(finishCredits(script, { style: "punch-in" }, true), 0, "nothing is charged in demo mode");
  assert.deepEqual(priceWithFinish(120, 40), { credits: 160, parts: { video: 120, finish: 40 } });
});

const recorder = () => {
  const calls: { queue: string; args: unknown[] }[] = [];
  const queues: FinishQueues = {
    layout: async (...args) => {
      calls.push({ queue: "layout", args });
      return { jobId: "child-layout" };
    },
    captions: async (...args) => {
      calls.push({ queue: "captions", args });
      return { jobId: "child-captions" };
    },
  };
  return { calls, queues };
};

test("a style finish lays the video out, carrying the caption preset with it", async () => {
  const { calls, queues } = recorder();
  const outcome = await runFinish(queues, {
    userId: "u1",
    videoId: VIDEO,
    finish: { style: "punch-in", media: [{ key: "uploads/u1/a.png", role: "picture" }], captions: "yellow-pop" },
  });
  assert.deepEqual(outcome, { status: "started", videoId: "child-layout" });
  assert.deepEqual(calls, [
    {
      queue: "layout",
      args: ["u1", VIDEO, { style: "punch-in", media: [{ key: "uploads/u1/a.png", role: "picture" }], showText: true, captionPreset: "yellow-pop" }],
    },
  ]);
});

test("a style with captions off lays out without captions; a caption style alone gets a captions pass", async () => {
  const off = recorder();
  await runFinish(off.queues, { userId: "u1", videoId: VIDEO, finish: { style: "sketch-explainer", captions: false } });
  assert.deepEqual(off.calls[0].args[2], { style: "sketch-explainer", showText: false });
  const only = recorder();
  const outcome = await runFinish(only.queues, { userId: "u1", videoId: VIDEO, finish: { captions: "karaoke" } });
  assert.deepEqual(outcome, { status: "started", videoId: "child-captions" });
  assert.deepEqual(only.calls, [{ queue: "captions", args: ["u1", VIDEO, "karaoke"] }]);
});

test("a finish that can't start is skipped with a plain reason, and the plain video is kept", async () => {
  const broke: FinishQueues = {
    layout: async () => {
      throw new InsufficientCreditsError(90, 12);
    },
    captions: async () => ({ jobId: "x" }),
  };
  const noCredits = await runFinish(broke, { userId: "u1", videoId: VIDEO, finish: { style: "punch-in" } });
  assert.equal(noCredits.status, "skipped");
  assert.match(noCredits.reason ?? "", /enough video credits/);

  const layoutError = Object.assign(new Error("That video isn't finished yet."), { name: "LayoutRequestError" });
  const notReady = await runFinish({ ...broke, layout: async () => Promise.reject(layoutError) }, { userId: "u1", videoId: VIDEO, finish: { style: "punch-in" } });
  assert.equal(notReady.reason, "That video isn't finished yet, so the plain video was kept.");

  const original = console.error;
  console.error = () => {};
  try {
    const crash = await runFinish({ ...broke, layout: async () => Promise.reject(new Error("ECONNRESET at s3.amazonaws.com")) }, { userId: "u1", videoId: VIDEO, finish: { style: "punch-in" } });
    assert.equal(crash.reason, "It couldn't be styled, so the plain video was kept.", "an internal error is never passed on");
  } finally {
    console.error = original;
  }
});

test("a video that succeeds starts its finish before it is reported; a failed one is only reported", async () => {
  const order: string[] = [];
  const steps = {
    startFinish: async () => void order.push("finish"),
    deliver: async () => void order.push("report"),
  };
  await reportEnded("succeeded", steps);
  assert.deepEqual(order, ["finish", "report"]);
  order.length = 0;
  await reportEnded("failed", steps);
  assert.deepEqual(order, ["report"]);
  order.length = 0;
  const original = console.error;
  console.error = () => {};
  try {
    await reportEnded("succeeded", { ...steps, startFinish: async () => Promise.reject(new Error("boom")) });
  } finally {
    console.error = original;
  }
  assert.deepEqual(order, ["report"], "a finish that throws never stops the report");
});

test("the finish view follows the base video: waiting, started, or skipped", () => {
  const stored = storedFinishFrom({ style: "punch-in", captions: "yellow-pop" });
  assert.deepEqual(finishView(stored, "running"), { style: "punch-in", captions: "yellow-pop", status: "waiting", videoId: null, reason: null });
  assert.deepEqual(finishView({ ...stored, status: "started", videoId: "child" }, "succeeded"), {
    style: "punch-in",
    captions: "yellow-pop",
    status: "started",
    videoId: "child",
    reason: null,
  });
  assert.equal(finishView({ ...stored, status: "skipped", reason: "No credits." }, "succeeded")?.reason, "No credits.");
  assert.equal(finishView(stored, "failed")?.status, "skipped");
  assert.equal(finishView(null, "succeeded"), null);
  assert.deepEqual(finishView(storedFinishFrom({ captions: "karaoke" }), "queued")?.style, null);
});

test("the finish kept on a job reads back, and broken ones are ignored", () => {
  const stored = storedFinishFrom({ style: "source-reader", media: [{ key: "uploads/u/p.png", role: "post", note: "the tweet" }], captions: false });
  assert.deepEqual(readStoredFinish({ prompt: "x", partnerFinish: stored }), stored);
  assert.deepEqual(readStoredFinish({ partnerFinish: { ...stored, status: "started", videoId: "c1" } })?.videoId, "c1");
  assert.equal(readStoredFinish({ partnerFinish: { style: "wobble" } }), null);
  assert.equal(readStoredFinish({ partnerFinish: { captions: false } }), null);
  assert.equal(readStoredFinish({}), null);
  assert.equal(readStoredFinish(null), null);
});

test("failures reach the partner in plain words, and internal messages never do", () => {
  assert.equal(partnerFailureMessage("Pick a video model."), GENERIC_FAILURE);
  assert.equal(partnerFailureMessage("This queued video is missing a model, format, or length."), GENERIC_FAILURE);
  assert.equal(partnerFailureMessage("OpenRouter 502: upstream heygen timeout"), GENERIC_FAILURE);
  assert.equal(partnerFailureMessage(null), GENERIC_FAILURE);
  assert.match(partnerFailureMessage("No speech was found in that video."), /No speech was found/);
  assert.match(partnerFailureMessage("Pick a character with a picture to present the ad."), /needs a picture/);
  assert.match(partnerFailureMessage("Request was flagged by content moderation"), /safety check/);
  assert.match(partnerFailureMessage("No face detected in the image"), /No face was found/);
  for (const message of [GENERIC_FAILURE, partnerFailureMessage("No speech was found in that video.")]) {
    assert.doesNotMatch(message, /polivid|heygen|openrouter|kling|elevenlabs|model/i);
  }
});

test("only failed and canceled videos can be tried again", () => {
  assert.ok(canRetry("failed"));
  assert.ok(canRetry("canceled"));
  for (const status of ["queued", "running", "succeeded"]) assert.equal(canRetry(status), false, status);
});

test("trying again rebuilds the same request, finish included, from what the job kept", () => {
  const ugcRaw = {
    prompt: "Try this today.",
    aspectRatio: "9:16",
    duration: 2,
    model: "heygen/heygen-avatar-6",
    mode: "ugc",
    tier: "pro",
    characterId: CHARACTER,
    mediaKey: "uploads/u/product.png",
    visualDirection: "In a kitchen.",
    showText: false,
    partnerFinish: { style: "punch-in", captions: "yellow-pop", status: "skipped", reason: "No credits." },
  };
  assert.deepEqual(retryPlanFor("ugc", readJobInput(ugcRaw), ugcRaw), {
    kind: "create",
    input: {
      kind: "ugc",
      characterId: CHARACTER,
      script: "Try this today.",
      productKey: "uploads/u/product.png",
      direction: "In a kitchen.",
      format: "9:16",
      tier: "pro",
      captions: false,
      finish: { style: "punch-in", captions: "yellow-pop" },
    },
  });
  const plan = retryPlanFor("ugc", readJobInput(ugcRaw), ugcRaw);
  assert.ok(plan?.kind === "create" && PartnerVideoSchema.safeParse(plan.input).success, "the rebuilt request passes the partner schema");

  // A character's own picture is never sent back as an upload.
  const avatarRaw = { prompt: "Hello there.", mode: "avatar", tier: "low", aspectRatio: "1:1", characterId: CHARACTER, mediaKey: "characters/u/face.png" };
  const avatar = retryPlanFor("avatar", readJobInput(avatarRaw), avatarRaw);
  assert.deepEqual(avatar, { kind: "create", input: { kind: "avatar", characterId: CHARACTER, script: "Hello there.", format: "1:1", tier: "low" } });

  const photoRaw = { prompt: "Hello there.", mode: "avatar", tier: "pro", mediaKey: "uploads/u/me.png" };
  assert.deepEqual(retryPlanFor("avatar", readJobInput(photoRaw), photoRaw)?.kind, "create");
  assert.equal(retryPlanFor("avatar", readJobInput({ prompt: "Hi.", mode: "avatar" }), {}), null, "no picture and no character");

  const skitRaw = {
    prompt: "[Quill slips] I never saw it coming.",
    mode: "skit",
    tier: "ultra",
    characterId: CHARACTER,
    visualDirection: "Bouncy.",
    partnerFinish: { captions: "comic" },
  };
  const skit = retryPlanFor("skit", readJobInput(skitRaw), skitRaw);
  assert.deepEqual(skit, {
    kind: "create",
    input: {
      kind: "skit",
      characterId: CHARACTER,
      script: "[Quill slips] I never saw it coming.",
      direction: "Bouncy.",
      format: "9:16",
      tier: "ultra",
      finish: { captions: "comic" },
    },
  });
  assert.ok(skit?.kind === "create" && PartnerVideoSchema.safeParse(skit.input).success, "a skit retry passes the partner schema");
  assert.equal(retryPlanFor("skit", readJobInput({ prompt: "Hi.", mode: "skit" }), {}), null, "no character to act it");

  const facelessRaw = { prompt: "One line. Another.", mode: "voiceover", tier: "pro", characterId: "studio" };
  assert.deepEqual(retryPlanFor("voiceover", readJobInput(facelessRaw), facelessRaw), {
    kind: "create",
    input: { kind: "faceless", script: "One line. Another.", format: "9:16", tier: "pro" },
  });

  const uploadCaptions = { prompt: "Add captions.", mode: "captions", mediaKey: "uploads/u/v.mp4" };
  assert.deepEqual(retryPlanFor("captions", readJobInput(uploadCaptions), uploadCaptions), { kind: "create", input: { kind: "captions", videoKey: "uploads/u/v.mp4" } });
  const finishedCaptions = { prompt: "Add captions.", mode: "captions", captioning: { sourceVideoId: VIDEO, preset: "karaoke" } };
  assert.deepEqual(retryPlanFor("captions", readJobInput(finishedCaptions), finishedCaptions), { kind: "captions-finished", videoId: VIDEO, preset: "karaoke" });

  const layoutRaw = {
    prompt: "Title",
    mode: "layout-style",
    showText: true,
    layout: { style: "source-reader", sourceVideoId: VIDEO, media: [{ key: "uploads/u/p.png", kind: "image", role: "post" }], captionPreset: "bold-caps" },
  };
  assert.deepEqual(retryPlanFor("layout-style", readJobInput(layoutRaw), layoutRaw), {
    kind: "layout",
    videoId: VIDEO,
    style: "source-reader",
    media: [{ key: "uploads/u/p.png", role: "post" }],
    showText: true,
    captionPreset: "bold-caps",
  });
  assert.equal(retryPlanFor("prompt", readJobInput({ prompt: "x", mode: "prompt" }), {}), null, "a mode a partner can't start");
});

test("options list every style and caption look, with nothing about how they're made", () => {
  const options = partnerVideoOptions();
  assert.equal(options.styles.length, 6);
  const reader = options.styles.find((style) => style.id === "source-reader");
  assert.deepEqual(reader?.needs, ["post"]);
  assert.equal(options.styles.find((style) => style.id === "sketch-explainer")?.avatar, false);
  assert.equal(options.captionStyles.length, 20);
  const pop = options.captionStyles.find((style) => style.id === "yellow-pop");
  assert.equal(pop?.label, "Yellow pop");
  assert.ok(pop?.categories.includes("Business & ads"));
  for (const style of options.styles) assert.deepEqual(Object.keys(style).sort(), ["avatar", "description", "id", "needs", "title"]);
  for (const style of options.captionStyles) assert.deepEqual(Object.keys(style).sort(), ["categories", "id", "label"]);
  assert.doesNotMatch(JSON.stringify(options), /polivid|heygen|openrouter|kling|remotion/i);
});

test("a layout job keeps its caption preset, and a captions job can caption a finished video", () => {
  const layout = readLayoutSettings({ style: "punch-in", sourceVideoId: VIDEO, media: [], captionPreset: "yellow-pop" });
  assert.equal(layout?.captionPreset, "yellow-pop");
  assert.equal(readLayoutSettings({ style: "punch-in", sourceVideoId: VIDEO, media: [], captionPreset: "<script>" })?.captionPreset, undefined);
  assert.deepEqual(readCaptioning({ sourceVideoId: VIDEO, preset: "karaoke" }), { sourceVideoId: VIDEO, preset: "karaoke" });
  assert.deepEqual(readCaptioning({ sourceVideoId: VIDEO }), { sourceVideoId: VIDEO, preset: "" });
  assert.equal(readCaptioning({ sourceVideoId: "../etc" }), null);
  assert.equal(readJobInput({ prompt: "x", mode: "captions" }).captioning, null);
});

test("a caption preset restyles captions where they are, and captions a finished video from its own file", () => {
  const timeline = buildCaptionedTimeline({ format: "9:16", videoId: VIDEO, seconds: 4, lines: [{ text: "Hello there", start: 0, end: 2 }] });
  assert.deepEqual(timeline.assets[0].source, { type: "video", videoId: VIDEO });
  const before = timeline.tracks[1].items[0];
  const styled = restyleCaptionsInPlace(timeline, "yellow-pop");
  const after = styled.tracks[1].items[0];
  assert.ok(before.kind === "text" && after.kind === "text");
  assert.match(after.style.fontFamily, /Montserrat/);
  assert.deepEqual([after.from, after.durationInFrames, after.transform.y], [before.from, before.durationInFrames, before.transform.y]);
  assert.deepEqual(styled.tracks[0], timeline.tracks[0], "the picture is untouched");
  assert.equal(restyleCaptionsInPlace(timeline, "nope"), timeline);
});
