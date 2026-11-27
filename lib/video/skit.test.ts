import assert from "node:assert/strict";
import test from "node:test";
import { videoJobCredits } from "@/lib/billing/estimate";
import { generationModelBySlug } from "./models";
import { resolveModeTier, VIDEO_MODES, videoModeById } from "./modes";
import { NO_ON_SCREEN_TEXT } from "./on-screen-text";
import { spokenScript } from "./script-markup";
import {
  DEFAULT_SKIT_LOOK,
  MAX_SKIT_BEATS,
  SKIT_LOOKS,
  skitBeats,
  skitCharacterPrompt,
  skitCharacterProblem,
  skitCuts,
  skitLookOf,
  skitLookPreset,
  skitMayDrawCharacter,
  skitSeconds,
  skitShotPrompt,
} from "./skit";
import { CREATE_TOOLS } from "./tool-catalog";

const KLING = generationModelBySlug("kling-4.0")!.durations;

test("a note in brackets steers its shot, up to the next note, without being read", () => {
  const beats = skitBeats(
    "[Quill slips on a stack of papers] I never saw it coming. Three drafts, gone in one second.\n[Quill stands up, dusts off a wing] So I back up everything now.",
    KLING,
  );
  assert.deepEqual(
    beats.map((beat) => [beat.say, beat.show]),
    [
      ["I never saw it coming. Three drafts, gone in one second.", "Quill slips on a stack of papers"],
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

test("a skit is a mode on the Create page, filmed by Kling at each tier", () => {
  const mode = videoModeById("skit");
  assert.ok(mode && !mode.partnerOnly && mode.referenceImages && mode.spokenScript);
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
  assert.ok(CREATE_TOOLS.some((tool) => tool.mode === "skit"), "on the Create page");
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
      ["I write daily. No notes here at all, just words.", "Quill bows"],
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

test("with no notes, each sentence is its own beat that acts out its line", () => {
  const beats = skitBeats("Mornings are hard for every writer I know. Coffee helps a little bit. Writing first thing helps more.", KLING);
  assert.equal(beats.length, 3);
  assert.ok(beats.every((beat) => beat.show === ""));
});

test("sentences before the first note keep their own beat, and a note never makes a shot longer than the model films", () => {
  const beats = skitBeats("Want new readers who actually stay and read? [Orel stares at a Note with three likes] Give them a reason to stop.", KLING);
  assert.deepEqual(
    beats.map((beat) => [beat.say, beat.show]),
    [
      ["Want new readers who actually stay and read?", ""],
      ["Give them a reason to stop.", "Orel stares at a Note with three likes"],
    ],
  );
  const long = Array.from({ length: 12 }, () => "This sentence has exactly eight words in it.").join(" ");
  for (const beat of skitBeats(`[paces the room] ${long}`, KLING)) {
    assert.ok(beat.seconds <= Math.max(...KLING), `${beat.seconds}s fits one shot`);
  }
});

test("a note covers the sentences after it: the script Quill wrote films three acted shots, not six", () => {
  const beats = skitBeats(
    "[Orel stares at a Note that gets likes from the same three friends] Want new readers? Give them a reason to stop. [He crosses out a line and writes a new one] Lead with the useful result. [A new reader pauses, tries the step, and taps follow] One clear takeaway. One step they can use. Make the Note for someone who doesn't know you yet.",
    KLING,
  );
  assert.equal(beats.length, 3);
  assert.ok(beats.every((beat) => beat.show !== ""));
});

test("a skit's look: unset or Auto is auto, own and the four drawn looks are kept, anything else is refused", () => {
  assert.equal(skitLookOf(undefined), "auto");
  assert.equal(skitLookOf(""), "auto");
  assert.equal(skitLookOf("auto"), "auto");
  assert.equal(skitLookOf("own"), "own");
  for (const look of SKIT_LOOKS) assert.equal(skitLookOf(look), look);
  assert.equal(skitLookOf("ultra-realism"), null);
  assert.equal(DEFAULT_SKIT_LOOK, "retro-cartoon");
  assert.equal(skitMayDrawCharacter("own"), false);
  assert.equal(skitMayDrawCharacter("auto"), true);
});

test("a drawn skit draws the character once in the look, keeping who they are, and every shot names the look", () => {
  const look = skitLookPreset("pixel-art");
  const drawing = skitCharacterPrompt(look);
  assert.match(drawing, /Pixel art/);
  assert.match(drawing, /instantly recognisable as the same character/);
  const shot = skitShotPrompt({ beat: { say: "Hi.", show: "waves", seconds: 3 }, pictures: 1, look });
  assert.match(shot, /Art style, for the character and the whole scene: Pixel art/);
  assert.match(shot, /Image 1 shows the character/);
  assert.doesNotMatch(skitShotPrompt({ beat: { say: "Hi.", show: "waves", seconds: 3 }, pictures: 2 }), /Art style/);
});

test("drawing the character adds one picture to a skit's price, and the Create page offers only the drawn looks", () => {
  const cuts = skitCuts("[waves] Hello there, friends. [bows] Thanks for watching.", KLING);
  const length = cuts.reduce((sum, cut) => sum + cut.seconds, 0);
  const base = { mode: "skit", tier: "pro", modelSlug: "kling-4.0", resolution: "720p", length, cuts };
  assert.ok(videoJobCredits({ ...base, drawsCharacter: true }) > videoJobCredits(base));
  const tool = CREATE_TOOLS.find((entry) => entry.mode === "skit");
  assert.deepEqual(tool?.presets, SKIT_LOOKS);
});
