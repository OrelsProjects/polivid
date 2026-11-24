import assert from "node:assert/strict";
import test from "node:test";
import { TimelineSchema } from "@/lib/editor/schema";
import type { TimedWord } from "../captions";
import { beatsFromWords, lastSentenceAlone } from "./beats";
import { enforcePlan } from "./rules";
import { enforceSketch } from "./sketch";
import { LAYOUT_STYLES, layoutStyleById, type LayoutMedia } from "./styles";
import { buildLayoutTimeline } from "./timeline";

const SCRIPT =
  "Forty-three percent of Notes never reach 10 strangers. Strangers are the only people who subscribe. So stop counting likes. Open your stats. Check your Unconnected views today. That number grows a newsletter. Follow for more.";
const words: TimedWord[] = SCRIPT.split(/\s+/).map((text, index) => ({ text, start: index * 0.35, end: index * 0.35 + 0.3 }));
const total = words.at(-1)!.end + 0.4;
const POST: LayoutMedia = { key: "uploads/u/post.png", kind: "image", role: "post" };
const RECORDING: LayoutMedia = { key: "uploads/u/screen.mp4", kind: "video", role: "recording" };

const planFor = (id: string, media: LayoutMedia[] = [], suggested: Record<string, unknown>[] = []) => {
  const style = layoutStyleById(id)!;
  const beats = beatsFromWords(words, { ...style.beatSeconds, total, sentences: id === "punch-in" });
  return { style, beats, plans: enforcePlan({ style, beats, suggested, media, script: SCRIPT }) };
};

test("punch-in alternates normal and close at each sentence, with at most a few short cutaways", () => {
  const { beats, plans } = planFor("punch-in", [], Array.from({ length: 20 }, () => ({ layout: "picture" })));
  assert.equal(beats.length, 7);
  const cutaways = plans.filter((plan) => plan.layout === "picture").length;
  assert.ok(cutaways >= 1 && cutaways <= Math.max(1, Math.floor(beats.length / 4)));
  for (let index = 1; index < plans.length; index += 1) {
    if (plans[index].layout === "picture") assert.notEqual(plans[index - 1].layout, "picture");
  }
  const takes = plans.filter((plan) => plan.layout !== "picture").map((plan) => plan.layout);
  assert.deepEqual(takes.slice(0, 2), ["avatar", "avatar-close"]);
});

test("source reader reads the post in a bubble, keeps the same post across beats, and ends on the speaker", () => {
  const { plans } = planFor("source-reader", [POST]);
  assert.equal(plans[0].layout, "bubble");
  assert.equal(plans.at(-1)!.layout, "avatar");
  const bubbles = plans.filter((plan) => plan.layout === "bubble");
  assert.ok(bubbles.length >= 1 && bubbles.every((plan) => plan.upload === 0));
  // Without a post, it is the speaker the whole way.
  assert.ok(planFor("source-reader").plans.every((plan) => plan.layout === "avatar"));
});

test("framed post keeps the band and ends on the call-to-action card", () => {
  const { plans } = planFor("framed-post");
  assert.ok(plans.slice(0, -1).every((plan) => plan.layout === "framed"));
  assert.equal(plans.at(-1)!.layout, "endcard");
});

test("screen demo opens close, then keeps one recording playing in the window", () => {
  const { plans } = planFor("screen-demo", [RECORDING]);
  assert.equal(plans[0].layout, "avatar-close");
  assert.ok(plans.slice(1).every((plan) => plan.layout === "window" && plan.upload === 0));
  // With nothing to show in the window, it never draws: it stays on the speaker.
  assert.ok(planFor("screen-demo").plans.slice(1).every((plan) => plan.layout === "avatar" && !plan.picture));
});

test("a sketch keeps only numbers the person wrote, and falls back when a chart loses them", () => {
  assert.deepEqual(enforceSketch({ headline: "Reach", kind: "number", items: [{ label: "never reach strangers", value: "43%" }] }, "x", "43% of notes"), {
    headline: "Reach",
    kind: "number",
    items: [{ label: "never reach strangers", value: "43%" }],
  });
  const madeUp = enforceSketch({ headline: "Growth", kind: "bars", items: [{ label: "Likes", value: "58%" }, { label: "Views", value: "12%" }] }, "x", "43% of notes");
  assert.equal(madeUp.kind, "steps");
  assert.ok(madeUp.items.every((item) => !("value" in item) || item.value === undefined));
  assert.equal(enforceSketch({ headline: "One two three four five", kind: "words", items: [] }, "Stop counting likes", "").headline, "Stop counting");
});

test("every style builds a timeline that parses, with captions that keep their word timing", () => {
  for (const style of LAYOUT_STYLES) {
    const media = style.id === "source-reader" ? [POST] : style.id === "screen-demo" ? [RECORDING] : [];
    const { beats, plans } = planFor(style.id, media);
    const timeline = buildLayoutTimeline({
      format: "9:16",
      style,
      source: { videoId: "00000000-0000-4000-8000-000000000001", seconds: total },
      take: style.avatar ? { focus: { x: 50, y: 35 } } : undefined,
      beats,
      plans,
      media: plans.map((plan, index) => (plan.upload !== undefined ? { key: media[plan.upload].key, kind: media[plan.upload].kind } : plan.picture ? { key: `uploads/u/drawn-${index}.png`, kind: "image" as const } : null)),
      captions: true,
      header: { name: "Orel", headline: "Strangers subscribe" },
    });
    TimelineSchema.parse(JSON.parse(JSON.stringify(timeline)));
    const captions = timeline.tracks.flatMap((track) => track.items.filter((item) => item.kind === "text" && item.role === "caption"));
    assert.ok(captions.length > 0, style.id);
    assert.ok(captions.every((item) => item.kind === "text" && item.words?.length), style.id);
    if (!style.avatar) assert.ok(!timeline.assets.some((asset) => asset.id === "take"), "a sketch has no take");
    if (style.id === "screen-demo") {
      // The recording plays on in one window clip instead of restarting at every beat.
      const windows = timeline.tracks.flatMap((track) => track.items.filter((item) => item.kind === "video" && item.assetId !== "take"));
      assert.equal(windows.length, 1);
    }
  }
});

test("the end card carries only the last sentence", () => {
  const style = layoutStyleById("framed-post")!;
  const beats = lastSentenceAlone(beatsFromWords(words, { ...style.beatSeconds, total }));
  assert.equal(beats.at(-1)!.say, "Follow for more.");
  assert.equal(beats.map((beat) => beat.say).join(" "), SCRIPT);
  assert.equal(beats.at(-2)!.end, beats.at(-1)!.start);
});
