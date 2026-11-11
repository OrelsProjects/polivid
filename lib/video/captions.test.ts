import assert from "node:assert/strict";
import test from "node:test";
import { captionLinesFromWords, closestFormat, evenCaptionLines, parseTimedWords, type TimedWord } from "./captions";

const word = (text: string, start: number, end: number): TimedWord => ({ text, start, end });

test("only spoken words with usable times are read from a transcription reply", () => {
  const reply = {
    text: "Hello there. Bye",
    words: [
      { text: "Hello", start: 0.1, end: 0.4, type: "word" },
      { text: " ", start: 0.4, end: 0.5, type: "spacing" },
      { text: "there.", start: 0.5, end: 0.9, type: "word" },
      { text: "(laughs)", start: 1, end: 1.4, type: "audio_event" },
      { text: "Bye", start: 2.2, end: 2.1 },
      { text: "", start: 3, end: 3.2, type: "word" },
      { text: "lost", start: "4", end: 4.2, type: "word" },
      { text: "early", start: -1, end: 0, type: "word" },
      null,
    ],
  };
  assert.deepEqual(parseTimedWords(reply), [word("Hello", 0.1, 0.4), word("there.", 0.5, 0.9), word("Bye", 2.2, 2.2)]);
  assert.deepEqual(parseTimedWords(null), []);
  assert.deepEqual(parseTimedWords({ words: "nope" }), []);
  assert.deepEqual(parseTimedWords({ text: "no timings" }), []);
});

test("words arriving out of order are put back in time order", () => {
  const sorted = parseTimedWords({ words: [{ text: "b", start: 2, end: 2.2 }, { text: "a", start: 1, end: 1.2 }] });
  assert.deepEqual(sorted.map((entry) => entry.text), ["a", "b"]);
});

test("lines break at four words, at punctuation, and at a pause", () => {
  const words = [
    word("So", 0, 0.2),
    word("here", 0.25, 0.5),
    word("is", 0.55, 0.7),
    word("the", 0.75, 0.9),
    word("thing,", 0.95, 1.3),
    word("right?", 1.35, 1.7),
    word("Wait.", 3.5, 3.9),
    word("Listen", 4.0, 4.4),
  ];
  const lines = captionLinesFromWords(words);
  assert.deepEqual(lines.map((line) => line.text), ["So here is the", "thing, right?", "Wait.", "Listen"]);
  assert.equal(lines.map((line) => line.text).join(" "), words.map((entry) => entry.text).join(" "));
});

test("a line stays up until the next begins, but not across a pause", () => {
  const lines = captionLinesFromWords([
    word("One", 0, 0.3),
    word("two.", 0.35, 0.7),
    word("Three", 0.9, 1.2),
    word("four.", 1.25, 1.6),
    word("Five.", 5, 5.4),
  ]);
  assert.equal(lines[0]?.end, 0.9, "held to the start of the next line");
  assert.ok((lines[1]?.end ?? 0) <= 1.6 + 0.6 + 1e-9, "dropped during the silence");
  assert.ok((lines[1]?.end ?? 0) < 5);
  for (let index = 1; index < lines.length; index += 1) {
    assert.ok((lines[index]?.start ?? 0) >= (lines[index - 1]?.end ?? 0) - 1e-9, "lines never overlap");
  }
});

test("slow speech is not left on screen as one long line", () => {
  const lines = captionLinesFromWords([word("Very", 0, 1.4), word("slow", 1.5, 2.9), word("words", 3, 4.4)]);
  assert.ok(lines.length >= 2);
  assert.deepEqual(captionLinesFromWords([]), []);
});

test("a transcript without timings is spread evenly over the clip", () => {
  const lines = evenCaptionLines("One two three four five six seven eight.", 4, 30);
  assert.equal(lines.map((line) => line.text).join(" "), "One two three four five six seven eight.");
  assert.equal(lines[0]?.start, 0);
  assert.ok(Math.abs((lines.at(-1)?.end ?? 0) - 4) < 1e-9);
  assert.deepEqual(evenCaptionLines("", 4, 30), []);
});

test("a captioned upload keeps the shape closest to its own", () => {
  assert.equal(closestFormat(1080, 1920), "9:16");
  assert.equal(closestFormat(1920, 1080), "16:9");
  assert.equal(closestFormat(1080, 1080), "1:1");
  assert.equal(closestFormat(1080, 1350), "1:1", "4:5 is nearest to square");
  assert.equal(closestFormat(1280, 960), "16:9", "4:3 is nearest to wide");
  assert.equal(closestFormat(null, null), "9:16");
});
