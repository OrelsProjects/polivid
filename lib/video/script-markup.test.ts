import assert from "node:assert/strict";
import test from "node:test";
import { videoJobCredits } from "@/lib/billing/estimate";
import {
  DEFAULT_PAUSE_SECONDS,
  MAX_PAUSE_SECONDS,
  hasScriptMarkup,
  loopBeatsForScript,
  parseScript,
  scriptSize,
  spokenScript,
  stillBeatsForScript,
  stillPictureCount,
} from "./script-markup";
import { MAX_STILLS, countWords, secondsForWords, splitScript, stillCountFor } from "./stills";

const STORY = [
  "Once upon a time, in a quiet forest.",
  "A dragon appeared. [a small golden dragon between tall pines]",
  '<break time="1.0s" />',
  "And so the story begins.",
].join("\n");

test("a note in brackets steers the picture and is never read", () => {
  const runs = parseScript(STORY);
  assert.deepEqual(
    runs.map((run) => run.say),
    ["Once upon a time, in a quiet forest.", "A dragon appeared.", "And so the story begins."],
  );
  assert.equal(runs[1]?.show, "a small golden dragon between tall pines");
  assert.equal(runs[0]?.show, "");
  assert.ok(!spokenScript(STORY).includes("["), "no bracket reaches the voice");
  assert.ok(!spokenScript(STORY).includes("break"), "no pause mark reaches the voice");
});

test("a pause follows the words before it, in either spelling", () => {
  assert.equal(parseScript(STORY)[1]?.pause, 1);
  assert.equal(parseScript("One. [pause 2s] Two.")[0]?.pause, 2);
  assert.equal(parseScript("One. [pause] Two.")[0]?.pause, DEFAULT_PAUSE_SECONDS);
  assert.equal(parseScript("One. [pause 500ms] Two.")[0]?.pause, 0.5);
  assert.equal(parseScript('One. <break time="750ms"/> Two.')[0]?.pause, 0.75);
  assert.equal(parseScript("One. <break> Two.")[0]?.pause, DEFAULT_PAUSE_SECONDS);
  assert.equal(parseScript("One. [pause 60s] Two.")[0]?.pause, MAX_PAUSE_SECONDS, "one pause is capped");
  assert.equal(parseScript("One. [pause 4s] [pause 4s] Two.")[0]?.pause, MAX_PAUSE_SECONDS, "stacked pauses are capped");
  assert.deepEqual(
    parseScript("[pause 2s] One.").map((run) => run.pause),
    [0],
    "a pause before the first word is dropped",
  );
});

test("a note on its own line steers the next picture, or the last one when nothing follows", () => {
  const ahead = parseScript("[a lighthouse at dusk]\nThe light came on.\nShips turned for home.");
  assert.equal(ahead[0]?.show, "a lighthouse at dusk");
  assert.equal(ahead[1]?.show, "");
  const behind = parseScript("The light came on.\n[a lighthouse at dusk]");
  assert.equal(behind.length, 1);
  assert.equal(behind[0]?.show, "a lighthouse at dusk");
});

test("taking a note out leaves clean punctuation and spacing", () => {
  assert.equal(spokenScript("A dragon [golden] appeared [close up]."), "A dragon appeared.");
  assert.equal(spokenScript("  Hello   there [wave] ,  friend.  "), "Hello there, friend.");
  assert.equal(spokenScript("[only a note]"), "");
  assert.equal(parseScript("").length, 0);
});

test("only notes and pauses count as markup", () => {
  assert.equal(hasScriptMarkup("A plain line.\nAnother one."), false);
  assert.equal(hasScriptMarkup("A line [with a note]."), true);
  assert.equal(hasScriptMarkup('A line. <break time="1s" />'), true);
});

test("each line of a marked script is one picture, with its note and pause", () => {
  const beats = stillBeatsForScript(STORY, 10);
  assert.deepEqual(beats, [
    { say: "Once upon a time, in a quiet forest.", show: "", pause: 0 },
    { say: "A dragon appeared.", show: "a small golden dragon between tall pines", pause: 1 },
    { say: "And so the story begins.", show: "", pause: 0 },
  ]);
});

test("a plain one-line script is cut by length, as before", () => {
  const script =
    "Sleep is not downtime. While you rest, your brain replays the day. It keeps what matters, and it lets the rest go. " +
    "That is why a hard problem often looks easier in the morning. So the next time you are stuck, stop. Go to bed.";
  const length = secondsForWords(countWords(script));
  assert.deepEqual(
    stillBeatsForScript(script, length).map((beat) => beat.say),
    splitScript(script, stillCountFor(length, countWords(script))),
  );
});

test("a long line gets several pictures and keeps its note on each", () => {
  const line = `${Array.from({ length: 50 }, (_, index) => `word${index}`).join(" ")}. [a wide desert]`;
  const beats = stillBeatsForScript(`Short opener.\n${line} [pause 2s]`, 30);
  assert.equal(beats.length, 5, "one for the opener, four for fifty words");
  assert.ok(beats.slice(1).every((beat) => beat.show === "a wide desert"));
  assert.deepEqual(
    beats.map((beat) => beat.pause),
    [0, 0, 0, 0, 2],
    "the pause stays at the end of the line",
  );
  assert.equal(countWords(beats.map((beat) => beat.say).join(" ")), 52, "no word is added or dropped");
});

test("more lines than we can draw are joined, shortest neighbours first", () => {
  const lines = Array.from({ length: 30 }, (_, index) => `Line number ${index + 1} here.`);
  lines[4] = "Five. [pause 1s]";
  const script = lines.join("\n");
  const beats = stillBeatsForScript(script, 60);
  assert.equal(beats.length, MAX_STILLS);
  assert.equal(beats.map((beat) => beat.say).join(" "), spokenScript(script), "every word survives in order");
  assert.equal(
    beats.reduce((sum, beat) => sum + beat.pause, 0),
    1,
    "the pause survives the join",
  );
});

test("over a background only a pause ends a beat early", () => {
  const beats = loopBeatsForScript("One line here. [a note that does nothing]\nTwo lines here. [pause 1.5s]\nThree.");
  assert.deepEqual(beats, [
    { say: "One line here. Two lines here.", show: "", pause: 1.5 },
    { say: "Three.", show: "", pause: 0 },
  ]);
  const plain = "A plain script with no marks at all, read over a calm background for a short while.";
  assert.deepEqual(
    loopBeatsForScript(plain).map((beat) => beat.say),
    splitScript(plain, 1),
  );
});

test("the size of a script leaves out notes and adds pauses", () => {
  assert.deepEqual(scriptSize(STORY), { words: 16, pauseSeconds: 1, seconds: 8 }, "16 words at 2.5 a second, plus the pause");
  const plain = "One two three four five six seven eight nine ten.";
  assert.deepEqual(scriptSize(plain), { words: 10, pauseSeconds: 0, seconds: secondsForWords(10) });
  assert.equal(scriptSize("[just a note]").words, 0);
});

test("pictures are counted from the script only when it is read word for word over stills", () => {
  assert.equal(stillPictureCount({ prompt: STORY, verbatim: true, media: "stills", length: 7 }), 3);
  assert.equal(stillPictureCount({ prompt: STORY, verbatim: false, media: "stills", length: 7 }), undefined);
  assert.equal(stillPictureCount({ prompt: STORY, verbatim: true, media: "loop", length: 7 }), undefined);
  assert.equal(stillPictureCount({ prompt: STORY, verbatim: true, media: "", length: 7 }), undefined);
});

test("a script with many short lines is charged for the pictures it draws", () => {
  const script = Array.from({ length: 8 }, (_, index) => `Line ${index + 1}.`).join("\n");
  const length = Math.max(2, scriptSize(script).seconds);
  const pictures = stillPictureCount({ prompt: script, verbatim: true, media: "stills", length });
  assert.equal(pictures, 8);
  const byLength = videoJobCredits({ mode: "voiceover", media: "stills", tier: "pro", length });
  const byPictures = videoJobCredits({ mode: "voiceover", media: "stills", tier: "pro", length, pictures });
  assert.ok(byPictures > byLength, "eight pictures cost more than the three a seven-second video would get");
  assert.equal(
    videoJobCredits({ mode: "voiceover", media: "stills", tier: "pro", length, pictures: 99 }),
    videoJobCredits({ mode: "voiceover", media: "stills", tier: "pro", length, pictures: MAX_STILLS }),
    "never charged for more than the picture limit",
  );
});
