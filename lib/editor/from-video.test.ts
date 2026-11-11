import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_FACTS, DEMO_PLAN, DEMO_QUOTES } from "@/lib/video/demo";
import type { VideoRecord } from "@/lib/video/schema";
import { readTimeline } from "./coach-edits";
import { timelineFromVideo } from "./from-video";
import { TimelineSchema } from "./schema";

const video = (overrides: Partial<VideoRecord> = {}): VideoRecord => ({
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  prompt: "Why sleep matters",
  format: "9:16",
  length: 8,
  status: "ready",
  createdAt: "2026-01-01T00:00:00.000Z",
  title: "Why sleep matters",
  facts: DEMO_FACTS,
  quotes: DEMO_QUOTES,
  plan: DEMO_PLAN,
  searchSources: [],
  unverifiedFactIds: [],
  model: "demo",
  demo: true,
  error: null,
  ...overrides,
});

test("turns a filmed clip into one video item", () => {
  const timeline = timelineFromVideo(video(), { hasFootage: true });
  assert.equal(timeline.assets.length, 1);
  assert.equal(timeline.assets[0]?.kind, "video");
  assert.equal(timeline.assets[0]?.source.type === "video" && timeline.assets[0].source.layer, undefined);
  assert.equal(timeline.tracks[0]?.items.length, 1);
  assert.equal(timeline.tracks[0]?.items[0]?.kind, "video");
  assert.equal(timeline.tracks[0]?.items[0]?.durationInFrames, 240);
  assert.equal(timeline.tracks.find((track) => track.kind === "audio")?.items.length, 0);
});

test("a voiced video opens as clean footage plus a Voiceover clip", () => {
  const timeline = timelineFromVideo(video(), {
    hasFootage: true,
    hasSource: true,
    voice: { name: "Voiceover · Orel" },
  });
  const picture = timeline.assets.find((asset) => asset.kind === "video");
  const voice = timeline.assets.find((asset) => asset.name === "Voiceover · Orel");
  assert.equal(picture?.source.type === "video" && picture.source.layer, "source");
  assert.equal(voice?.source.type, "voice");
  const audio = timeline.tracks.find((track) => track.kind === "audio")?.items ?? [];
  assert.equal(audio.length, 1);
  assert.equal(audio[0]?.kind === "audio" ? audio[0].volume : null, 1);
  assert.equal(timeline.tracks[0]?.items[0]?.kind === "video" ? timeline.tracks[0].items[0].volume : null, 1);
  const reading = readTimeline(timeline);
  const pictureItem = reading.tracks.flatMap((track) => track.items).find((item) => item.kind === "video");
  assert.equal(pictureItem?.sound, "footage");
  assert.equal(pictureItem?.volume, 1);
  assert.equal(TimelineSchema.safeParse(timeline).success, true);
});

test("turns a motion-graphics plan into scene items", () => {
  const timeline = timelineFromVideo(video());
  assert.equal(timeline.tracks[0]?.items.length, DEMO_PLAN.scenes.length);
  assert.ok(timeline.tracks[0]?.items.every((item) => item.kind === "scene"));
  const total = timeline.tracks[0]?.items.reduce((sum, item) => sum + item.durationInFrames, 0);
  const expected = DEMO_PLAN.scenes.reduce((sum, scene) => sum + Math.round(scene.durationSec * 30), 0);
  assert.equal(total, expected);
});
