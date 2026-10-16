import assert from "node:assert/strict";
import test from "node:test";
import {
  compositionChunks,
  durationsForLyrics,
  lyricsCreditBreakdown,
  planShots,
  planSongSections,
  readSongBrief,
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
  const sections = planSongSections([{ name: "Song", lines: ["One", "Two", "Three", "Four"] }], 28, WAN);
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
