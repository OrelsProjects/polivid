import assert from "node:assert/strict";
import test from "node:test";
import { STORYBOARD_AUTO_APPROVE_UNDER } from "@/lib/billing/auto-approve";
import { songCredits, videoJobCredits } from "@/lib/billing/estimate";
import { PICTURE_CREDITS } from "@/lib/coach/picture-preview";
import { TOOL_DEFS } from "./registry";
import { approvalForCoachCall, approvalForSpend, creditsForToolInput, LOOKUP_CREDIT_TOOLS, spendNeedsApproval } from "./tool-credits";

test("199 credits run and 200 wait", () => {
  assert.equal(spendNeedsApproval(199), false);
  assert.equal(spendNeedsApproval(200), true);
  assert.equal(approvalForSpend({ asksApproval: true, destructive: false, credits: 199 }), "approved");
  assert.equal(approvalForSpend({ asksApproval: true, destructive: false, credits: 200 }), "user-approval");
  assert.equal(approvalForSpend({ asksApproval: true, destructive: true, credits: 0 }), "user-approval");
  assert.equal(approvalForSpend({ asksApproval: true, destructive: false, credits: null }), "user-approval");
  assert.equal(approvalForSpend({ asksApproval: false, destructive: false, credits: 500 }), "not-applicable");
});

test("cheap coach tools are priced under the line", () => {
  assert.equal(creditsForToolInput("generate_image", {}), PICTURE_CREDITS);
  assert.equal(creditsForToolInput("design_voice", {}), 1);
  assert.equal(creditsForToolInput("start_production", {}), 1);
  assert.equal(creditsForToolInput("export_edit", {}), 0);
  assert.equal(creditsForToolInput("make_motion_graphics", { length: 30, tier: "ultra" }), 80);
  const short = creditsForToolInput("make_prompt_video", { length: 5, tier: "pro" });
  const long = creditsForToolInput("make_prompt_video", { length: 30, tier: "pro" });
  assert.equal(short, videoJobCredits({ mode: "prompt", tier: "pro", length: 5 }));
  assert.equal(long, videoJobCredits({ mode: "prompt", tier: "pro", length: 30 }));
  assert.equal(spendNeedsApproval(short ?? 0), false);
  assert.equal(spendNeedsApproval(long ?? 0), true);
});

test("a saved character can push a long song over the line", () => {
  const plain = creditsForToolInput("compose_song", { length: 90 });
  const sung = creditsForToolInput("compose_song", { length: 90, characterId: "saved" });
  const attached = creditsForToolInput("compose_song", { length: 90 }, { attachedCharacterId: "saved" });
  const studio = creditsForToolInput("compose_song", { length: 90, characterId: "studio" });
  assert.equal(plain, songCredits(90, false));
  assert.equal(sung, songCredits(90, true));
  assert.equal(attached, sung);
  assert.equal(studio, plain);
  assert.equal(spendNeedsApproval(plain ?? 0), false);
  assert.equal(spendNeedsApproval(sung ?? 0), true);
});

test("a video with no length or a bad tier is not priced", () => {
  assert.equal(creditsForToolInput("make_prompt_video", {}), null);
  assert.equal(creditsForToolInput("make_prompt_video", { length: 10, tier: "nope" }), null);
  assert.equal(creditsForToolInput("make_prompt_video", { length: 30, tier: "pro" }, { demo: true }), 0);
  assert.equal(creditsForToolInput("generate_image", {}, { demo: true }), 1);
});

test("a footage model picked on the brief reprices the video", () => {
  const tier = creditsForToolInput("make_prompt_video", { length: 10, tier: "pro" });
  const chosen = creditsForToolInput("make_prompt_video", { length: 10, tier: "pro" }, { generationModelId: "wan" });
  assert.equal(tier, videoJobCredits({ mode: "prompt", tier: "pro", length: 10 }));
  assert.equal(chosen, videoJobCredits({ mode: "prompt", modelId: "wan", resolution: "720p", length: 10 }));
  assert.notEqual(tier, chosen);
});

test("lyrics include reference pictures and an existing song", () => {
  assert.equal(
    creditsForToolInput("make_lyrics_video", { length: 14, tier: "low", referenceKeys: ["a"], songId: "song" }),
    videoJobCredits({ mode: "lyrics", tier: "low", length: 14, referenceCount: 1, songReady: true }),
  );
});

test("a storyboard costs one credit a frame and asks at 30", () => {
  const scenes = [{ seconds: 5, beat: "One", shotPrompt: "A roof" }, { seconds: 5, beat: "Two", shotPrompt: "A leap" }];
  assert.equal(creditsForToolInput("make_storyboard", { scenes }), scenes.length * PICTURE_CREDITS);
  assert.equal(creditsForToolInput("make_storyboard", {}), null);
  assert.equal(
    approvalForSpend({ asksApproval: true, destructive: false, credits: 29, threshold: STORYBOARD_AUTO_APPROVE_UNDER }),
    "approved",
  );
  assert.equal(
    approvalForSpend({ asksApproval: true, destructive: false, credits: 30, threshold: STORYBOARD_AUTO_APPROVE_UNDER }),
    "user-approval",
  );
});

test("a video waits unless they approved a brief or asked to run wild", () => {
  const video = { approval: "user" as const, destructive: false, films: true, credits: 40 };
  assert.equal(approvalForCoachCall({ ...video, runWild: false, briefApproved: false }), "user-approval");
  assert.equal(approvalForCoachCall({ ...video, runWild: true, briefApproved: false }), "approved");
  assert.equal(approvalForCoachCall({ ...video, runWild: false, briefApproved: true }), "approved");
  assert.equal(approvalForCoachCall({ ...video, credits: 200, runWild: true, briefApproved: false }), "user-approval");
  assert.equal(
    approvalForCoachCall({
      approval: "user",
      destructive: false,
      films: false,
      credits: 3,
      runWild: false,
      briefApproved: false,
      threshold: STORYBOARD_AUTO_APPROVE_UNDER,
    }),
    "approved",
  );
});

test("every credit tool is priced from its input or looked up", () => {
  const lookup = new Set<string>(LOOKUP_CREDIT_TOOLS);
  for (const definition of TOOL_DEFS) {
    if (!definition.effects.spendsCredits) continue;
    const credits = creditsForToolInput(definition.name, {
      length: 8,
      tier: "low",
      mode: "prompt",
      scenes: [{ seconds: 4, beat: "Open", shotPrompt: "A street" }, { seconds: 4, beat: "End", shotPrompt: "A door" }],
    });
    if (lookup.has(definition.name)) assert.equal(credits, null, definition.name);
    else assert.equal(typeof credits, "number", `${definition.name} ${credits}`);
  }
});

test("a talking avatar and a UGC ad are priced by how long their script takes to say", () => {
  const script = "word ".repeat(50).trim();
  const avatar = creditsForToolInput("make_avatar_video", { prompt: script, format: "9:16", tier: "pro" });
  const ugc = creditsForToolInput("make_ugc_video", { prompt: script, format: "9:16", tier: "pro" });
  assert.ok(typeof avatar === "number" && avatar > 0);
  assert.equal(ugc, (avatar as number) + 8);
  // A length passed with the script does not change the price.
  assert.equal(creditsForToolInput("make_avatar_video", { prompt: script, format: "9:16", tier: "pro", length: 90 }), avatar);
});

test("a model named in the tool call changes the price", () => {
  const base = { prompt: "A street at night", format: "9:16", length: 10, tier: "pro" };
  const tierPrice = creditsForToolInput("make_prompt_video", base);
  const klingPrice = creditsForToolInput("make_prompt_video", { ...base, model: "kling-4" });
  assert.equal(typeof tierPrice, "number");
  assert.equal(typeof klingPrice, "number");
  assert.notEqual(tierPrice, klingPrice);
  // A model picked on the approval card still wins over the one typed into the call.
  assert.equal(
    creditsForToolInput("make_prompt_video", { ...base, model: "kling-4" }, { generationModelId: "wan" }),
    creditsForToolInput("make_prompt_video", { ...base, model: "wan" }),
  );
});

test("the direct mode tool is priced like a filmed clip", () => {
  const credits = creditsForToolInput("make_direct_video", { prompt: "rain", format: "9:16", length: 5, model: "kling-4" });
  assert.equal(typeof credits, "number");
  assert.ok((credits ?? 0) > 0);
});

test("make_skit_video is priced by its beats at each tier", () => {
  const script =
    "[Quill types fast, a coffee cup wobbles] Day one of my big essay.\n[The coffee spills on the keyboard] Three hours of work. Gone.\n[Quill does a tiny victory dance] Back up your drafts.";
  const [low, pro, ultra] = (["low", "pro", "ultra"] as const).map((tier) => creditsForToolInput("make_skit_video", { prompt: script, format: "9:16", tier }) ?? 0);
  assert.ok(low > 0 && low < pro && pro < ultra, `${low} < ${pro} < ${ultra}`);
  const oneMoreBeat = creditsForToolInput("make_skit_video", { prompt: `${script}\n[Quill takes a bow] The end.`, format: "9:16", tier: "pro" }) ?? 0;
  assert.ok(oneMoreBeat > pro, "another beat costs another shot");
});

test("make_skit_video with an agreed plan is priced by the plan's shots", () => {
  const script = "[waves] Hello there, friends. [bows] Thanks for watching.";
  const short = creditsForToolInput("make_skit_video", {
    prompt: script,
    tier: "pro",
    skitPlan: [
      { shot: "Quill waves.", seconds: 3, sound: "" },
      { shot: "Quill bows.", seconds: 3, sound: "" },
    ],
  }) ?? 0;
  const long = creditsForToolInput("make_skit_video", {
    prompt: script,
    tier: "pro",
    skitPlan: [
      { shot: "Quill waves.", seconds: 10, sound: "" },
      { shot: "Quill bows.", seconds: 10, sound: "a thud" },
    ],
  }) ?? 0;
  assert.ok(short > 0 && long > short, `${short} < ${long}`);
});

test("a skit call saved in a chat before holds existed still reads back exactly as saved", () => {
  // The AI SDK checks a chat's earlier tool calls against today's schema and fails the turn if
  // parsing changes them, so a new field must not fill in a default.
  const saved = {
    tier: "low",
    format: "9:16",
    prompt: "[waves] Hello there. [bows] Bye.",
    skitPlan: [
      { shot: "Quill waves.", sound: "light applause", seconds: 3 },
      { shot: "Quill bows.", sound: "", seconds: 2 },
    ],
    characterId: "character",
  };
  const schema = TOOL_DEFS.find((definition) => definition.name === "make_skit_video")!.inputSchema;
  const parsed = schema.parse(saved) as { skitPlan: unknown };
  assert.deepEqual(parsed.skitPlan, saved.skitPlan);
});
