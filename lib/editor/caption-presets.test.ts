import assert from "node:assert/strict";
import test from "node:test";
import { CAPTION_FONTS, bundledFont } from "./caption-fonts";
import { addTimedCaptions, applyCaptionPreset, CAPTION_PRESETS, captionLinesFromWords, styleAllCaptions } from "./caption-presets";
import { activeWordIndex, captionWords } from "./caption-words";
import { addCaptionsEdit, isCaption } from "./coach-edits";
import { emptyTimeline, TimelineSchema, type TextItem, type Timeline } from "./schema";

const captionsOf = (timeline: Timeline) => timeline.tracks.flatMap((track) => track.items.filter(isCaption)) as TextItem[];

const SPEECH = "So stop counting likes. Check your views today.".split(" ").map((text, index) => ({ text, start: index * 0.4, end: index * 0.4 + 0.35 }));

test("every preset uses a bundled font and only categories the gallery has", () => {
  assert.ok(CAPTION_PRESETS.length >= 20);
  assert.equal(new Set(CAPTION_PRESETS.map((preset) => preset.id)).size, CAPTION_PRESETS.length);
  for (const preset of CAPTION_PRESETS) {
    const font = bundledFont(preset.style.fontFamily);
    assert.ok(font, preset.id);
    assert.ok(font.files.some((file) => file.weight === preset.style.fontWeight), `${preset.id} weight ${preset.style.fontWeight}`);
    assert.ok(preset.maxWords >= 1);
  }
  assert.equal(CAPTION_FONTS.length, 8);
});

test("words are spread evenly over a caption that has no timing, and the spoken word follows the frame", () => {
  const words = captionWords({ text: "one two three", durationInFrames: 30 });
  assert.deepEqual(words.map((word) => word.from), [0, 10, 20]);
  assert.equal(activeWordIndex(words, 0), 0);
  assert.equal(activeWordIndex(words, 15), 1);
  assert.equal(activeWordIndex(words, 29), 2);
  assert.equal(activeWordIndex([{ text: "late", from: 5, to: 9 }], 2), -1);
});

test("lines close at the word limit and at punctuation, and keep their own word times", () => {
  const lines = captionLinesFromWords(
    [
      { text: "So", from: 0, to: 9 },
      { text: "stop.", from: 12, to: 20 },
      { text: "Check", from: 24, to: 30 },
      { text: "your", from: 32, to: 38 },
      { text: "views", from: 40, to: 48 },
    ],
    2,
  );
  assert.deepEqual(lines.map((line) => line.text), ["So stop.", "Check your", "views"]);
  assert.equal(lines[1].from, 24);
  assert.deepEqual(lines[1].words.map((word) => word.from), [0, 8]);
});

test("timed captions get the preset's look on their own track, replacing old captions", () => {
  const timeline = addTimedCaptions(emptyTimeline("9:16"), SPEECH, "yellow-pop", 30);
  TimelineSchema.parse(timeline);
  const captions = captionsOf(timeline);
  assert.ok(captions.length >= 4);
  assert.ok(captions.every((item) => item.words?.length && item.text.split(" ").length <= 2));
  assert.equal(captions[0].style.activeWord?.color, "#FFD400");
  assert.equal(captionsOf(addTimedCaptions(timeline, SPEECH.slice(0, 2), "bold-caps", 30)).length, 1);
});

test("a preset re-cuts timed captions to its line length and restyles untimed ones in place", () => {
  const timed = addTimedCaptions(emptyTimeline("9:16"), SPEECH, "one-word", 30);
  assert.equal(captionsOf(timed).length, SPEECH.length);
  const recut = applyCaptionPreset(timed, "subtle");
  assert.ok(captionsOf(recut).length < SPEECH.length);
  assert.equal(captionsOf(recut).map((item) => item.text).join(" "), SPEECH.map((word) => word.text).join(" "));

  const untimed = addCaptionsEdit(emptyTimeline("16:9"), [{ text: "An old caption line", startSec: 0, endSec: 2 }]).timeline;
  const restyled = applyCaptionPreset(untimed, "elegant");
  assert.equal(captionsOf(restyled).length, 1);
  assert.equal(captionsOf(restyled)[0].text, "An old caption line");
  assert.match(captionsOf(restyled)[0].style.fontFamily, /Playfair Display/);
});

test("custom changes touch every caption and nothing else", () => {
  const base = addTimedCaptions(emptyTimeline("9:16"), SPEECH, "bold-caps", 30);
  const styled = styleAllCaptions(base, { color: "#FF0000", uppercase: undefined }, -30);
  assert.ok(captionsOf(styled).every((item) => item.style.color === "#FF0000" && item.transform.y === -30 && !item.style.uppercase));
  assert.throws(() => applyCaptionPreset(emptyTimeline("9:16"), "bold-caps"), /no captions/);
});
