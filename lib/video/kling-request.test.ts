import assert from "node:assert/strict";
import test from "node:test";
import { isKlingOutOfCredit, KLING_UNAVAILABLE, klingCall, klingSwapCall, klingSwapEditCall, klingTaskFailure, type KlingVideoRequest } from "./kling-request";
import { clipDuration, generationModelById } from "./models";

const base: KlingVideoRequest = {
  model: "kling-4.0",
  prompt: "A paper boat rides a rain gutter at night",
  duration: 5,
  resolution: "720p",
  aspectRatio: "9:16",
  generateAudio: true,
};

const reference = (url: string) => ({ type: "image_url", image_url: { url } });

test("Kling 4.0 films a prompt on the text endpoint with only shape, size and length", () => {
  const call = klingCall(base);
  assert.equal(call.url, "https://api-singapore.klingai.com/text-to-video/kling-4.0");
  assert.deepEqual(call.body, {
    prompt: base.prompt,
    settings: { resolution: "720p", aspect_ratio: "9:16", duration: 5 },
    options: { watermark_info: { enabled: false } },
  });
});

test("Kling 4.0 sends pictures to the omni endpoint, the start frame first", () => {
  const call = klingCall({
    ...base,
    imageDataUrl: "data:image/png;base64,frame",
    inputReferences: [reference("data:image/png;base64,frame"), reference("https://x.test/a.png"), reference("https://x.test/b.png")],
  });
  assert.equal(call.url, "https://api-singapore.klingai.com/omni-video/kling-4.0");
  assert.deepEqual(call.body.contents, [
    { type: "prompt", text: base.prompt },
    { type: "first_frame", url: "data:image/png;base64,frame" },
    { type: "refer_image", url: "https://x.test/a.png", id: "image_1" },
    { type: "refer_image", url: "https://x.test/b.png", id: "image_2" },
  ]);
  assert.deepEqual(call.body.settings, { resolution: "720p", aspect_ratio: "9:16", duration: 5 });
});

test("a character picture alone is a reference for Kling 4.0, not a start frame", () => {
  const call = klingCall({ ...base, model: "kling-4.0-flash", inputReferences: [reference("https://x.test/a.png")] });
  assert.equal(call.url, "https://api-singapore.klingai.com/omni-video/kling-4.0-flash");
  assert.deepEqual(call.body.contents, [
    { type: "prompt", text: base.prompt },
    { type: "refer_image", url: "https://x.test/a.png", id: "image_1" },
  ]);
});

test("Kling 4.0 takes ten pictures at most and a longer prompt than Kling 3.0", () => {
  const many = Array.from({ length: 14 }, (_, index) => reference(`https://x.test/${index}.png`));
  const long = "a".repeat(20000);
  const four = klingCall({ ...base, prompt: long, imageDataUrl: "https://x.test/frame.png", inputReferences: many });
  const contents = four.body.contents as { type: string; text?: string }[];
  assert.equal(contents.length, 11);
  assert.equal(contents[0]?.text?.length, 11000);
  const three = klingCall({ ...base, model: "kling-3.0", prompt: long });
  assert.equal((three.body.prompt as string).length, 3000);
});

test("Kling 3.0 keeps its sound and single-shot settings", () => {
  const silent = klingCall({ ...base, model: "kling-3.0", generateAudio: false });
  assert.equal(silent.url, "https://api-singapore.klingai.com/text-to-video/kling-3.0");
  assert.deepEqual(silent.body.settings, {
    resolution: "720p",
    aspect_ratio: "9:16",
    duration: 5,
    audio: "off",
    multi_shot: false,
  });
  const framed = klingCall({ ...base, model: "kling-2.6", imageDataUrl: "https://x.test/frame.png" });
  assert.equal(framed.url, "https://api-singapore.klingai.com/image-to-video/kling-2.6");
  assert.equal((framed.body.settings as { resolution: string }).resolution, "1080p");
});

test("an unknown slug is refused", () => {
  assert.throws(() => klingCall({ ...base, model: "kling-9" }), /not a Kling model/);
});

test("every listed Kling model has a route, and 4.0 runs 3 to 30 seconds", () => {
  for (const id of ["kling-4", "kling-4-flash", "kling", "kling-turbo", "kling-omni", "kling-26", "kling-25"]) {
    const model = generationModelById(id);
    assert.ok(model, id);
    assert.doesNotThrow(() => klingCall({ ...base, model: model.slug, resolution: model.resolutions[0] ?? "720p" }), id);
  }
  const four = generationModelById("kling-4");
  const flash = generationModelById("kling-4-flash");
  assert.ok(four && flash);
  assert.equal(clipDuration(2, four.durations), 3);
  assert.equal(clipDuration(45, four.durations), 30);
  assert.equal(clipDuration(45, flash.durations), 20);
  assert.deepEqual(flash.resolutions, ["720p"]);
});

test("a character swap goes to Motion Control with the picture, the video, and the sound kept", () => {
  const call = klingSwapCall({
    imageUrl: "https://x.test/me.png",
    videoUrl: "https://x.test/dance.mp4",
    prompt: "  Wearing a red jacket  ",
    orientation: "video",
    resolution: "720p",
    keepSound: true,
  });
  assert.equal(call.url, "https://api-singapore.klingai.com/motion-control/kling-3.0");
  assert.deepEqual(call.body, {
    contents: [
      { type: "prompt", text: "Wearing a red jacket" },
      { type: "image", url: "https://x.test/me.png" },
      { type: "video", url: "https://x.test/dance.mp4" },
    ],
    settings: { character_orientation: "video", resolution: "720p", audio: "original" },
    options: { watermark_info: { enabled: false } },
  });
});

test("a character swap with no prompt sends no prompt, and can mute the video", () => {
  const call = klingSwapCall({
    imageUrl: "https://x.test/me.png",
    videoUrl: "https://x.test/dance.mp4",
    prompt: "   ",
    orientation: "image",
    resolution: "1080p",
    keepSound: false,
  });
  assert.deepEqual(
    (call.body.contents as { type: string }[]).map((item) => item.type),
    ["image", "video"],
  );
  assert.deepEqual(call.body.settings, { character_orientation: "image", resolution: "1080p", audio: "off" });
});

test("an empty Kling account is a refusal, not a busy server to wait out", () => {
  assert.equal(isKlingOutOfCredit("Account balance not enough"), true);
  assert.equal(isKlingOutOfCredit("Insufficient resource package"), true);
  assert.equal(isKlingOutOfCredit("Too many requests, please slow down"), false);
  assert.equal(isKlingOutOfCredit("Service busy"), false);
});

test("replacing in a video sends the video to edit as base_video and the character as @image_1", () => {
  const call = klingSwapEditCall({
    imageUrls: ["https://x.test/greg.png"],
    videoUrl: "https://x.test/street.mp4",
    prompt: "Replace the monkey with @image_1.",
    resolution: "720p",
    duration: 6.6,
    keepSound: true,
  });
  assert.equal(call.url, "https://api-singapore.klingai.com/omni-video/kling-3.0-omni");
  assert.deepEqual(call.body, {
    contents: [
      { type: "prompt", text: "Replace the monkey with @image_1." },
      { type: "base_video", url: "https://x.test/street.mp4", id: "video_1" },
      { type: "refer_image", url: "https://x.test/greg.png", id: "image_1" },
    ],
    settings: { resolution: "720p", duration: 7, audio: "original", multi_shot: false },
    options: { watermark_info: { enabled: false } },
  });
});

test("replacing several characters sends one picture each, in order, and no more than Kling takes", () => {
  const call = klingSwapEditCall({
    imageUrls: ["https://x.test/a.png", "https://x.test/b.png", "https://x.test/c.png", "https://x.test/d.png", "https://x.test/e.png"],
    videoUrl: "https://x.test/street.mp4",
    prompt: "Replace the monkey with @image_1 and the man with @image_2.",
    resolution: "720p",
    duration: 5,
    keepSound: true,
  });
  const contents = call.body.contents as { type: string; url?: string; id?: string }[];
  assert.deepEqual(
    contents.filter((item) => item.type === "refer_image").map((item) => [item.id, item.url]),
    [
      ["image_1", "https://x.test/a.png"],
      ["image_2", "https://x.test/b.png"],
      ["image_3", "https://x.test/c.png"],
      ["image_4", "https://x.test/d.png"],
    ],
  );
});

test("a task Kling accepts and then fails for the account's balance says credits were returned", () => {
  assert.deepEqual(klingTaskFailure("Account balance not enough", "failed"), {
    message: KLING_UNAVAILABLE,
    outOfCredit: true,
    detail: "Account balance not enough",
  });
  assert.equal(klingTaskFailure("Image pixel is invalid", "failed").message, "Image pixel is invalid");
  assert.equal(klingTaskFailure(undefined, "failed").message, "Kling failed.");
});
