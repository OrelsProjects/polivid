import assert from "node:assert/strict";
import test from "node:test";
import type { TimedWord } from "../captions";
import { beatsFromWords, captionLines } from "./beats";
import { enforcePlan, highlightFromBeat, statFromScript } from "./rules";
import { layoutStyleById } from "./styles";

const timed = (text: string, wordSeconds = 0.4): TimedWord[] =>
  text.split(/\s+/).map((word, index) => ({ text: word, start: index * wordSeconds, end: index * wordSeconds + wordSeconds * 0.9 }));

const SCRIPT =
  "Forty-three percent of Substack Notes never reach ten strangers. And strangers are the only people who can subscribe. So stop counting likes, and start counting the people you have not met yet. Check your Unconnected views today. That number is the one that grows a newsletter. Follow for more.";

test("beats cover the whole take back to back, close at sentence ends, and never pass the max", () => {
  const words = timed(SCRIPT);
  const total = words.at(-1)!.end + 0.3;
  const beats = beatsFromWords(words, { target: 2.5, max: 3.5, total });
  assert.equal(beats[0].start, 0);
  assert.equal(beats.at(-1)!.end, total);
  for (const [index, beat] of beats.entries()) {
    if (index > 0) assert.equal(beat.start, beats[index - 1].end);
    assert.ok(beat.words.at(-1)!.end - beat.words[0].start <= 3.5 + 0.4, beat.say);
  }
  assert.equal(beats.map((beat) => beat.say).join(" "), SCRIPT);
});

test("sentence beats close at every sentence end", () => {
  const beats = beatsFromWords(timed("One. Two words. Three more words here."), { target: 5, max: 9, total: 4, sentences: true });
  assert.deepEqual(beats.map((beat) => beat.say), ["One.", "Two words.", "Three more words here."]);
});

test("caption lines follow the words and run back to back to the end of the beat", () => {
  const [beat] = beatsFromWords(timed("So stop counting likes today"), { target: 9, max: 9, total: 3 });
  const lines = captionLines(beat, 2);
  assert.deepEqual(lines.map((line) => line.text), ["So stop", "counting likes", "today"]);
  assert.equal(lines.at(-1)!.end, beat.end);
  assert.equal(lines[1].start, lines[0].end);
});

test("a stat survives only when its numbers come from the script", () => {
  assert.equal(statFromScript("43% never reach 10", "43% of notes never reach 10 strangers"), "43% never reach 10");
  assert.equal(statFromScript("2,400 readers", "We reached 2400 readers"), "2,400 readers");
  assert.equal(statFromScript("58% grow", "43% of notes"), undefined);
  assert.equal(statFromScript("No number", "43%"), undefined);
});

test("a highlight survives only as words the beat says", () => {
  assert.equal(highlightFromBeat("likes", "So stop counting likes, and start"), "likes");
  assert.equal(highlightFromBeat("followers", "So stop counting likes"), undefined);
  assert.equal(highlightFromBeat("a whole long phrase here", "a whole long phrase here"), undefined);
});

test("split presenter opens and closes on a close-up and keeps close-ups to about a fifth", () => {
  const style = layoutStyleById("split-presenter")!;
  const words = timed(SCRIPT);
  const beats = beatsFromWords(words, { ...style.beatSeconds, total: words.at(-1)!.end });
  const plans = enforcePlan({
    style,
    beats,
    suggested: beats.map(() => ({ layout: "avatar-close" as const, highlight: "nope", stat: "99%" })),
    media: [],
    script: SCRIPT,
  });
  assert.equal(plans[0].layout, "avatar-close");
  assert.equal(plans.at(-1)!.layout, "avatar-close");
  const closeSeconds = plans.reduce((sum, plan, index) => sum + (plan.layout === "avatar-close" ? beats[index].end - beats[index].start : 0), 0);
  const total = beats.at(-1)!.end - beats[0].start;
  assert.ok(closeSeconds <= total * 0.25 + (beats[0].end - beats[0].start), `${closeSeconds} of ${total}`);
  for (let index = 1; index < plans.length - 1; index += 1) {
    if (plans[index].layout === "avatar-close") assert.notEqual(plans[index - 1].layout, "avatar-close");
  }
  // Every split beat has something to show, and the invented stat and highlight are gone.
  for (const plan of plans) {
    if (plan.layout === "split") assert.ok(plan.picture || plan.upload !== undefined);
    assert.equal(plan.stat, undefined);
    assert.equal(plan.highlight, undefined);
  }
});

test("uploads are used once, where they fit, before anything is drawn", () => {
  const style = layoutStyleById("split-presenter")!;
  const words = timed(SCRIPT);
  const beats = beatsFromWords(words, { ...style.beatSeconds, total: words.at(-1)!.end });
  const plans = enforcePlan({
    style,
    beats,
    suggested: beats.map((_, index) => (index === 2 ? { layout: "card" as const, upload: 0 } : index === 3 ? { layout: "card" as const } : { layout: "split" as const })),
    media: [
      { key: "uploads/u/post.png", kind: "image", role: "post" },
      { key: "uploads/u/photo.png", kind: "image", role: "picture" },
    ],
    script: SCRIPT,
  });
  assert.equal(plans[2].layout, "card");
  assert.equal(plans[2].upload, 0);
  // A card with no post left falls back to split.
  assert.equal(plans[3].layout, "split");
  assert.equal(plans.filter((plan) => plan.upload === 1).length, 1);
  assert.equal(plans.filter((plan) => plan.upload === 0).length, 1);
});
