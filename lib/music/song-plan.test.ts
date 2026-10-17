import assert from "node:assert/strict";
import test from "node:test";
import {
  compositionChunks,
  durationsForLyrics,
  filmSecondsFor,
  lyricsCreditBreakdown,
  normalizeCuts,
  retimeCut,
  planShots,
  planShotsFromCuts,
  planSongSections,
  readSongBrief,
  songReferences,
  splitLyricSections,
} from "./song-plan";

const WAN = Array.from({ length: 29 }, (_, index) => index + 2);

test("a style line stays out of the lyric sheet", () => {
  const brief = readSongBrief("Style: indie pop, 124 BPM\n\nCoffee's cold\nStill writing");
  assert.equal(brief.style, "indie pop, 124 BPM");
  assert.equal(brief.lyrics, "Coffee's cold\nStill writing");
});

test("section tags keep lyric order", () => {
  const sections = splitLyricSections("[Verse]\nOne\nTwo\n\n[Chorus]\nThree");
  assert.deepEqual(
    sections.map((section) => section.name),
    ["Verse", "Chorus"],
  );
  assert.deepEqual(sections[0]?.lines, ["One", "Two"]);
  assert.deepEqual(sections[1]?.lines, ["Three"]);
});

test("blank lines split stanzas when there are no tags", () => {
  const sections = splitLyricSections("One\nTwo\n\nThree");
  assert.equal(sections.length, 2);
  assert.deepEqual(sections[1]?.lines, ["Three"]);
});

test("section durations add up and stay long enough to sing", () => {
  const sections = planSongSections(splitLyricSections("[Verse]\nOne\nTwo\n\n[Chorus]\nThree\nFour"), 90, WAN);
  const total = sections.reduce((sum, section) => sum + section.durationSec, 0);
  assert.equal(total, 90);
  assert.ok(sections.every((section) => section.durationSec >= 3 && section.durationSec <= 120));
  assert.ok(sections.every((section) => section.clips.reduce((sum, clip) => sum + clip, 0) === section.durationSec));
});

test("a singer photo alternates performance and b-roll", () => {
  const sections = planSongSections(
    [{ name: "Song", lines: ["One", "Two", "Three", "Four"] }],
    28,
    Array.from({ length: 9 }, (_, index) => index + 2),
  );
  const shots = planShots(sections, true);
  assert.ok(shots.length >= 2);
  assert.deepEqual(
    shots.map((shot) => shot.kind),
    shots.map((_, index) => (index % 2 === 0 ? "performance" : "broll")),
  );
  assert.equal(
    shots.reduce((sum, shot) => sum + shot.durationSec, 0),
    sections.reduce((sum, section) => sum + section.durationSec, 0),
  );
});

test("without a singer every shot is b-roll", () => {
  const shots = planShots(planSongSections([{ name: "Song", lines: ["One"] }], 14, WAN), false);
  assert.ok(shots.every((shot) => shot.kind === "broll"));
});

test("singer and b-roll models share clip lengths", () => {
  const shared = durationsForLyrics(WAN, [4, 5, 6, 7, 8]);
  assert.deepEqual(shared, [4, 5, 6, 7, 8]);
  const priced = lyricsCreditBreakdown(14, shared, true);
  assert.equal(priced.songSeconds, priced.singerSeconds + priced.brollSeconds);
  assert.ok(priced.singerSeconds > 0);
  assert.ok(priced.brollSeconds > 0);
});

test("composition chunks use the section length and the style", () => {
  const sections = planSongSections([{ name: "Verse", lines: ["Coffee's cold"] }], 8, WAN);
  const chunks = compositionChunks(sections, "indie pop, acoustic guitar");
  assert.equal(chunks.length, 1);
  assert.match(chunks[0]!.text, /\[Verse\]/);
  assert.match(chunks[0]!.text, /Coffee's cold/);
  assert.equal(chunks[0]!.duration_ms, sections[0]!.durationSec * 1000);
  assert.ok(chunks[0]!.positive_styles.includes("indie pop"));
});

test("song references put the performer first, then the location, then the framing", () => {
  const plan = songReferences({
    performerKey: "singer",
    sceneKeys: ["roof", "street"],
    directionKeys: ["wide", "close"],
  });
  assert.deepEqual(plan.keys, ["singer", "roof", "street", "wide"]);
  assert.equal(
    plan.note,
    "Image 1 is the performer. Images 2-3 show the location: match the set and light. Image 4 shows framing: copy the camera and composition, not the people.",
  );
});

test("a lip-sync shot keeps the performer and one location picture", () => {
  const plan = songReferences({
    performerKey: "singer",
    sceneKeys: ["roof", "street"],
    directionKeys: ["wide"],
    lipSync: true,
  });
  assert.deepEqual(plan.keys, ["singer", "roof"]);
  assert.match(plan.note, /Image 1 is the performer/);
  assert.match(plan.note, /Image 2 shows the location/);
  assert.doesNotMatch(plan.note, /framing/);
});

test("scene pictures alone do not invent a performer", () => {
  const plan = songReferences({ sceneKeys: ["roof", "roof", "street"] });
  assert.deepEqual(plan.keys, ["roof", "street"]);
  assert.equal(plan.note, "Images 1-2 show the location: match the set and light.");
  assert.doesNotMatch(plan.note, /performer/);
});

const HAILUO = Array.from({ length: 11 }, (_, index) => index + 5);

test("cuts are resized so they add up to the video, and the list stays capped", () => {
  assert.deepEqual(
    normalizeCuts(
      [
        { seconds: 3, camera: "wide" },
        { seconds: 3, camera: "close" },
      ],
      10,
    ).map((cut) => cut.seconds),
    [3, 7],
  );
  assert.deepEqual(
    normalizeCuts(
      [
        { seconds: 8, camera: "a" },
        { seconds: 8, camera: "b" },
      ],
      10,
    ).map((cut) => cut.seconds),
    [8, 2],
  );
  const capped = normalizeCuts(
    Array.from({ length: 80 }, () => ({ seconds: 1, camera: "angle" })),
    80,
  );
  assert.equal(capped.length, 60);
  assert.equal(
    capped.reduce((sum, cut) => sum + cut.seconds, 0),
    80,
  );
  const packed = normalizeCuts(
    Array.from({ length: 80 }, () => ({ seconds: 1, camera: "angle" })),
    80,
    15,
  );
  assert.equal(packed.length, 60);
  assert.equal(
    packed.reduce((sum, cut) => sum + cut.seconds, 0),
    80,
  );
  assert.ok(packed.every((cut) => cut.seconds <= 15));
});

test("retiming one cut keeps the video length and the other framings", () => {
  const cuts = [
    { seconds: 2, camera: "wide" },
    { seconds: 2, camera: "close-up" },
    { seconds: 2, camera: "overhead" },
  ];
  const longer = retimeCut(cuts, 0, 4, 6, 15);
  assert.deepEqual(
    longer.map((cut) => [cut.seconds, cut.camera]),
    [
      [4, "wide"],
      [1, "close-up"],
      [1, "overhead"],
    ],
  );
  const shorter = retimeCut(cuts, 1, 1, 6, 15);
  assert.deepEqual(
    shorter.map((cut) => cut.seconds),
    [2, 1, 3],
  );
  assert.equal(shorter[1]?.camera, "close-up");
  const last = retimeCut(cuts, 2, 4, 6, 15);
  assert.deepEqual(
    last.map((cut) => cut.seconds),
    [1, 1, 4],
  );
  const stuck = retimeCut(
    Array.from({ length: 6 }, (_, index) => ({ seconds: 1, camera: `angle ${index}` })),
    0,
    3,
    6,
    15,
  );
  assert.ok(stuck.every((cut) => cut.seconds === 1));
  assert.equal(stuck[0]?.camera, "angle 0");
  const capped = retimeCut(cuts, 0, 20, 6, 4);
  assert.ok(capped.every((cut) => cut.seconds <= 4));
  assert.equal(
    capped.reduce((sum, cut) => sum + cut.seconds, 0),
    6,
  );
  assert.equal(retimeCut(cuts, 9, 3, 6, 15).length, 3);
});

test("a cut longer than the model can film is split", () => {
  const split = normalizeCuts([{ seconds: 40, camera: "wide shot" }], 40, 15);
  assert.deepEqual(
    split.map((cut) => cut.seconds),
    [15, 15, 10],
  );
  assert.ok(split.every((cut) => cut.camera === "wide shot"));
});

test("a one second cut is filmed at the model minimum", () => {
  assert.equal(filmSecondsFor(1, HAILUO), 5);
  assert.equal(filmSecondsFor(6, [5, 10]), 10);
  const shots = planShotsFromCuts(
    [{ name: "Song", lines: ["One"], clips: [10], durationSec: 10 }],
    normalizeCuts(
      Array.from({ length: 10 }, () => ({ seconds: 1, camera: "angle" })),
      10,
    ),
    false,
    HAILUO,
  );
  assert.equal(shots.length, 10);
  assert.ok(shots.every((shot) => shot.durationSec === 1 && shot.filmSec === 5));
  const priced = lyricsCreditBreakdown(
    10,
    HAILUO,
    false,
    Array.from({ length: 10 }, () => ({ seconds: 1, camera: "angle" })),
  );
  const steady = lyricsCreditBreakdown(10, HAILUO, false);
  assert.equal(priced.brollSeconds, 50);
  assert.equal(priced.songSeconds, 10);
  assert.ok(priced.brollSeconds > steady.brollSeconds);
});

test("each cut takes the lines of the section it sits in", () => {
  const shots = planShotsFromCuts(
    [
      { name: "Verse", lines: ["One", "Two"], clips: [5], durationSec: 5 },
      { name: "Chorus", lines: ["Three", "Four"], clips: [5], durationSec: 5 },
    ],
    [
      { seconds: 5, camera: "wide" },
      { seconds: 5, camera: "close-up" },
    ],
    true,
    WAN,
  );
  assert.equal(shots[0]?.sectionName, "Verse");
  assert.deepEqual(shots[0]?.lines, ["One", "Two"]);
  assert.equal(shots[0]?.kind, "performance");
  assert.equal(shots[1]?.sectionName, "Chorus");
  assert.deepEqual(shots[1]?.lines, ["Three", "Four"]);
  assert.equal(shots[1]?.kind, "broll");
  assert.equal(shots[1]?.camera, "close-up");
  assert.equal(shots[0]?.filmSec, 5);
});
