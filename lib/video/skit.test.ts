import assert from "node:assert/strict";
import test from "node:test";
import { videoJobCredits } from "@/lib/billing/estimate";
import { generationModelBySlug } from "./models";
import { resolveModeTier, VIDEO_MODES, videoModeById } from "./modes";
import { NO_ON_SCREEN_TEXT } from "./on-screen-text";
import { spokenScript } from "./script-markup";
import { MAX_SKIT_BEATS, skitBeats, skitCharacterProblem, skitCuts, skitSeconds, skitShotPrompt } from "./skit";
import { CREATE_TOOLS } from "./tool-catalog";

const KLING = generationModelBySlug("kling-4.0")!.durations;

test("each sentence is a beat, and a note in brackets steers its shot without being read", () => {
  const beats = skitBeats(
    "[Quill slips on a stack of papers] I never saw it coming. Three drafts, gone in one second.\n[Quill stands up, dusts off a wing] So I back up everything now.",
    KLING,
  );
  assert.deepEqual(
    beats.map((beat) => [beat.say, beat.show]),
    [
      ["I never saw it coming.", "Quill slips on a stack of papers"],
      ["Three drafts, gone in one second.", ""],
      ["So I back up everything now.", "Quill stands up, dusts off a wing"],
    ],
  );
  for (const beat of beats) assert.doesNotMatch(beat.say, /[[\]]|slips|dusts/);
});

test("the words read over the shots are exactly the script's spoken words", () => {
  const script = "[a big yawn] Mornings are hard. [pause 1s] Coffee helps.\nWriting helps more. [a thumbs up]";
  const said = skitBeats(script, KLING)
    .map((beat) => beat.say)
    .join(" ");
  assert.equal(said, spokenScript(script));
});

test("a short beat with no note joins a neighbour, but a beat with a note keeps its own shot", () => {
  const beats = skitBeats("Wow. That was fast. [Quill faints] Huh.", KLING);
  assert.equal(beats.length, 2);
  assert.equal(beats[0]!.say, "Wow. That was fast.");
  assert.deepEqual([beats[1]!.say, beats[1]!.show], ["Huh.", "Quill faints"]);
});

test("every shot is a length the model can film, and the video runs as long as its shots", () => {
  const beats = skitBeats("One. [jumps] Two words here. A much longer sentence that keeps going for a while to fill the time.", KLING);
  const shortest = Math.min(...KLING);
  for (const beat of beats) {
    assert.ok(KLING.includes(beat.seconds), `${beat.seconds}s is a legal clip`);
    assert.ok(beat.seconds >= shortest);
  }
  assert.equal(skitSeconds(beats), beats.reduce((sum, beat) => sum + beat.seconds, 0));
  assert.deepEqual(
    skitCuts("One. [jumps] Two words here.", KLING).map((cut) => cut.action),
    skitBeats("One. [jumps] Two words here.", KLING).map((beat) => beat.show || beat.say),
  );
});

test("a long script is joined down to the most beats a skit films", () => {
  const script = Array.from({ length: 30 }, (_, index) => `[gag ${index}] Line number ${index} is here and it has words.`).join("\n");
  assert.equal(skitBeats(script, KLING).length, MAX_SKIT_BEATS);
  assert.deepEqual(skitBeats("[only a note]", KLING), []);
});

test("a shot films the note, or acts out the line, and keeps the character's own look", () => {
  const acted = skitShotPrompt({ beat: { say: "I never saw it coming.", show: "", seconds: 3 }, pictures: 3 });
  assert.match(acted, /acts out this line, without saying it: "I never saw it coming\."/);
  assert.match(acted, /Images 1-3 show the character\. Keep their exact look and art style\./);
  assert.ok(acted.includes(NO_ON_SCREEN_TEXT));

  const noted = skitShotPrompt({ beat: { say: "Oops.", show: "Quill slips on papers", seconds: 3 }, pictures: 1, direction: "Bouncy energy." });
  assert.match(noted, /Action: Quill slips on papers/);
  assert.match(noted, /Image 1 shows the character/);
  assert.match(noted, /Direction: Bouncy energy\./);
  assert.doesNotMatch(noted, /Oops/, "a noted beat films the note, not the words");
  // Nothing is added that the writer didn't give: no look, setting, mood, or style.
  assert.doesNotMatch(acted, /cartoon|realistic|cinematic|funny|comic|studio|office|lighting/i);
});

test("a skit is a partner-only mode filmed by Kling at each tier", () => {
  const mode = videoModeById("skit");
  assert.ok(mode?.partnerOnly && mode.referenceImages && mode.spokenScript);
  assert.deepEqual(
    (["low", "pro", "ultra"] as const).map((tier) => {
      const resolved = resolveModeTier("skit", tier)!;
      return [resolved.model?.slug, resolved.resolution];
    }),
    [
      ["kling-4.0-flash", "720p"],
      ["kling-4.0", "720p"],
      ["kling-4.0", "1080p"],
    ],
  );
  assert.ok(!CREATE_TOOLS.some((tool) => tool.mode === "skit"), "kept off the Create page");
  assert.ok(VIDEO_MODES.includes(mode));
});

test("a skit is priced by its shots at the tier's model", () => {
  const script = "[Quill slips] I never saw it coming. Three drafts, gone. [Quill stands up] So I back up everything now.";
  const pro = resolveModeTier("skit", "pro")!;
  const cuts = skitCuts(script, pro.model!.durations);
  const length = cuts.reduce((sum, cut) => sum + cut.seconds, 0);
  const credits = videoJobCredits({ mode: "skit", tier: "pro", modelSlug: pro.model!.slug, resolution: pro.resolution, length, cuts });
  const usd = pro.model!.pricePerSecond[pro.resolution]!;
  assert.equal(credits, videoJobCredits({ mode: "prompt", modelSlug: pro.model!.slug, resolution: pro.resolution, length, cuts }));
  assert.ok(credits >= Math.round(usd * length * 100), `${credits} credits covers ${length}s of filming`);
  const low = resolveModeTier("skit", "low")!;
  const ultra = resolveModeTier("skit", "ultra")!;
  const at = (tier: typeof low) =>
    videoJobCredits({ mode: "skit", tier: tier.tier, modelSlug: tier.model!.slug, resolution: tier.resolution, length, cuts });
  assert.ok(at(low) < credits && credits < at(ultra));
});

test("a note steers the sentence it sits in or comes before, or the one before it at the end of a line", () => {
  const script = "Hello [waves]. I write daily. [Quill bows]\nNo notes here at all, just words.";
  const beats = skitBeats(script, KLING);
  assert.deepEqual(
    beats.map((beat) => [beat.say, beat.show]),
    [
      ["Hello.", "waves"],
      ["I write daily.", "Quill bows"],
      ["No notes here at all, just words.", ""],
    ],
  );
  assert.equal(beats.map((beat) => beat.say).join(" "), spokenScript(script));
});

test("a skit's character needs a picture and a voice", () => {
  assert.match(skitCharacterProblem(null)!, /has a picture/);
  assert.match(skitCharacterProblem({ imageKey: null, providerVoiceId: "v" })!, /has a picture/);
  assert.match(skitCharacterProblem({ imageKey: "characters/u/a.png", providerVoiceId: null })!, /no voice yet/);
  assert.equal(skitCharacterProblem({ imageKey: "characters/u/a.png", providerVoiceId: "v" }), null);
});
