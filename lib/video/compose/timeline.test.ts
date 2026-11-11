import assert from "node:assert/strict";
import test from "node:test";
import { TimelineSchema, timelineDurationInFrames } from "@/lib/editor/schema";
import { FPS } from "@/lib/video/schema";
import { buildCaptionedTimeline, buildLoopTimeline, buildStillsTimeline } from "./timeline";

const beats = [
  { imageKey: "uploads/u1/a.png", say: "Sleep is not downtime.", seconds: 1.8 },
  { imageKey: "uploads/u1/b.png", say: "While you rest, your brain replays the day.", seconds: 3.4 },
  { imageKey: "uploads/u1/c.png", say: "So go to bed.", seconds: 1.2 },
];

const build = (captions = true) => buildStillsTimeline({ jobId: "job-1", format: "9:16", beats, captions });

const track = (timeline: ReturnType<typeof build>, id: string) => {
  const found = timeline.tracks.find((entry) => entry.id === id);
  assert.ok(found, id);
  return found;
};

test("the timeline is one the editor and the renderer accept", () => {
  const parsed = TimelineSchema.safeParse(build());
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3)));
});

test("each picture is on screen for as long as its lines take, back to back", () => {
  const timeline = build();
  const pictures = track(timeline, "stills").items;
  assert.equal(pictures.length, 3);
  let cursor = 0;
  pictures.forEach((item, index) => {
    assert.equal(item.kind, "image");
    assert.equal(item.from, cursor);
    assert.equal(item.durationInFrames, Math.round((beats[index]?.seconds ?? 0) * FPS));
    cursor += item.durationInFrames;
  });
  assert.equal(timelineDurationInFrames(timeline), cursor);
  const voice = track(timeline, "voice").items[0];
  assert.equal(voice?.kind, "audio");
  assert.equal(voice?.durationInFrames, cursor);
});

test("pictures move, and no two neighbours move the same way", () => {
  const pictures = track(build(), "stills").items;
  const kinds = pictures.map((item) => (item.kind === "image" ? item.motion?.kind : undefined));
  assert.ok(kinds.every(Boolean));
  assert.notEqual(kinds[0], kinds[1]);
  assert.notEqual(kinds[1], kinds[2]);
});

test("captions sit inside their own beat and carry every spoken word", () => {
  const timeline = build();
  const pictures = track(timeline, "stills").items;
  const captions = track(timeline, "captions").items;
  pictures.forEach((picture, index) => {
    const lines = captions.filter((caption) => caption.id.startsWith(`caption-${index}-`));
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.ok(line.from >= picture.from);
      assert.ok(line.from + line.durationInFrames <= picture.from + picture.durationInFrames);
    }
    assert.equal(
      lines.map((line) => (line.kind === "text" ? line.text : "")).join(" "),
      beats[index]?.say,
    );
  });
});

test("captions can be turned off, and the voice and pictures stay", () => {
  const timeline = build(false);
  assert.equal(track(timeline, "captions").items.length, 0);
  assert.equal(track(timeline, "stills").items.length, 3);
  assert.equal(track(timeline, "voice").items.length, 1);
});

test("pictures come from the person's uploads and the voice from this job", () => {
  const timeline = build();
  assert.deepEqual(
    timeline.assets.filter((asset) => asset.kind === "image").map((asset) => asset.source),
    beats.map((beat) => ({ type: "upload", key: beat.imageKey })),
  );
  assert.deepEqual(timeline.assets.find((asset) => asset.kind === "audio")?.source, { type: "voice", videoId: "job-1" });
});

const loopBeats = [
  { say: "I did not expect the letter.", seconds: 2.1 },
  { say: "It came on a Tuesday, in the rain, with no return address.", seconds: 4.4 },
  { say: "I still have it.", seconds: 1.5 },
];

const buildLoop = (seconds: number, captions = true) =>
  buildLoopTimeline({
    jobId: "job-2",
    format: "9:16",
    beats: loopBeats,
    captions,
    background: { source: { type: "library", id: "aurora" }, seconds, name: "Aurora" },
  });

test("a loop timeline is one the editor and the renderer accept", () => {
  const parsed = TimelineSchema.safeParse(buildLoop(3));
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3)));
});

test("the background repeats, silent, for exactly as long as the voice runs", () => {
  const timeline = buildLoop(3);
  const total = loopBeats.reduce((sum, beat) => sum + Math.round(beat.seconds * FPS), 0);
  const passes = track(timeline, "loop").items;
  assert.equal(timelineDurationInFrames(timeline), total);
  assert.equal(passes.length, Math.ceil(total / (3 * FPS)));
  let cursor = 0;
  for (const pass of passes) {
    assert.equal(pass.kind, "video");
    assert.equal(pass.from, cursor);
    if (pass.kind === "video") assert.equal(pass.volume, 0);
    cursor += pass.durationInFrames;
  }
  assert.equal(cursor, total);
  assert.ok((passes.at(-1)?.durationInFrames ?? 0) <= 3 * FPS);
  assert.equal(track(timeline, "voice").items[0]?.durationInFrames, total);
});

test("a background longer than the voice plays once and is cut at the last word", () => {
  const timeline = buildLoop(60);
  const passes = track(timeline, "loop").items;
  assert.equal(passes.length, 1);
  assert.equal(passes[0]?.durationInFrames, timelineDurationInFrames(timeline));
});

test("loop captions carry every word, in the middle of the frame", () => {
  const captions = track(buildLoop(3), "captions").items;
  assert.equal(
    captions.map((caption) => (caption.kind === "text" ? caption.text : "")).join(" "),
    loopBeats.map((beat) => beat.say).join(" "),
  );
  assert.ok(captions.every((caption) => caption.kind === "text" && caption.transform.y === 0));
  assert.equal(track(buildLoop(3, false), "captions").items.length, 0);
});

const captioned = (lines: { text: string; start: number; end: number }[], seconds = 6) =>
  buildCaptionedTimeline({ format: "16:9", videoKey: "uploads/u1/talk.mp4", seconds, lines });

test("a captioned timeline keeps the upload whole, with its sound", () => {
  const timeline = captioned([{ text: "Hello there.", start: 0.5, end: 1.5 }]);
  assert.equal(TimelineSchema.safeParse(timeline).success, true);
  const source = track(timeline, "source").items[0];
  assert.equal(source?.kind, "video");
  if (source?.kind === "video") {
    assert.equal(source.volume, 1);
    assert.equal(source.transform.fit, "contain");
    assert.equal(source.durationInFrames, 6 * FPS);
  }
  assert.deepEqual(timeline.assets[0]?.source, { type: "upload", key: "uploads/u1/talk.mp4" });
  assert.equal(timelineDurationInFrames(timeline), 6 * FPS);
});

test("caption lines land on the frames their words are spoken", () => {
  const lines = track(captioned([
    { text: "Hello there.", start: 0.5, end: 1.5 },
    { text: "How are you?", start: 2, end: 3 },
  ]), "captions").items;
  assert.deepEqual(lines.map((line) => [line.from, line.durationInFrames]), [[15, 30], [60, 30]]);
});

test("overlapping, empty, and out-of-range lines cannot break the timeline", () => {
  const timeline = captioned([
    { text: "First", start: 0, end: 2 },
    { text: "Second", start: 1, end: 3 },
    { text: "   ", start: 3, end: 4 },
    { text: "Late", start: 5.9, end: 9 },
    { text: "Gone", start: 20, end: 21 },
  ]);
  assert.equal(TimelineSchema.safeParse(timeline).success, true);
  const lines = track(timeline, "captions").items;
  for (let index = 1; index < lines.length; index += 1) {
    const before = lines[index - 1];
    assert.ok((lines[index]?.from ?? 0) >= (before?.from ?? 0) + (before?.durationInFrames ?? 0));
  }
  assert.ok(lines.every((line) => line.from + line.durationInFrames <= 6 * FPS));
  assert.equal(lines.some((line) => line.kind === "text" && line.text.trim() === ""), false);
});

test("a pause keeps the picture up after its words, with no caption over the silence", () => {
  const paused = [
    { imageKey: "uploads/u1/a.png", say: "A dragon appeared.", seconds: 1.5, pause: 1 },
    { imageKey: "uploads/u1/b.png", say: "And so the story begins.", seconds: 2 },
  ];
  const timeline = buildStillsTimeline({ jobId: "job-1", format: "9:16", beats: paused, captions: true });
  assert.equal(TimelineSchema.safeParse(timeline).success, true);
  const pictures = track(timeline, "stills").items;
  assert.equal(pictures[0]?.durationInFrames, Math.round(2.5 * FPS), "the first picture covers its words and the pause");
  assert.equal(pictures[1]?.from, Math.round(2.5 * FPS), "the next picture starts when the pause ends");
  const firstCaptions = track(timeline, "captions").items.filter((item) => item.id.startsWith("caption-0-"));
  const lastWord = Math.max(...firstCaptions.map((item) => item.from + item.durationInFrames));
  assert.equal(lastWord, Math.round(1.5 * FPS), "captions end when the words do");
  const voice = track(timeline, "voice").items[0];
  assert.equal(voice?.durationInFrames, Math.round(4.5 * FPS), "the voice track runs through the pause");
});

test("a pause over a background holds the captions back for that long", () => {
  const timeline = buildLoopTimeline({
    jobId: "job-1",
    format: "9:16",
    beats: [
      { say: "One line here.", seconds: 1.2, pause: 1.5 },
      { say: "Three.", seconds: 0.6 },
    ],
    captions: true,
    background: { source: { type: "library", id: "aurora" }, seconds: 9, name: "Aurora" },
  });
  assert.equal(TimelineSchema.safeParse(timeline).success, true);
  const captions = track(timeline, "captions").items;
  const second = captions.find((item) => item.id.startsWith("caption-1-"));
  assert.equal(second?.from, Math.round(2.7 * FPS));
  const first = captions.filter((item) => item.id.startsWith("caption-0-"));
  assert.ok(first.every((item) => item.from + item.durationInFrames <= Math.round(1.2 * FPS)));
  assert.equal(timelineDurationInFrames(timeline), Math.round(3.3 * FPS));
});
