import assert from "node:assert/strict";
import test from "node:test";
import { songCredits, videoJobCredits } from "@/lib/billing/estimate";
import { PICTURE_CREDITS } from "@/lib/coach/picture-preview";
import { TOOL_DEFS } from "./registry";
import { approvalForSpend, creditsForToolInput, LOOKUP_CREDIT_TOOLS, spendNeedsApproval } from "./tool-credits";

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

test("lyrics include reference pictures and an existing song", () => {
  assert.equal(
    creditsForToolInput("make_lyrics_video", { length: 14, tier: "low", referenceKeys: ["a"], songId: "song" }),
    videoJobCredits({ mode: "lyrics", tier: "low", length: 14, referenceCount: 1, songReady: true }),
  );
});

test("every credit tool is priced from its input or looked up", () => {
  const lookup = new Set<string>(LOOKUP_CREDIT_TOOLS);
  for (const definition of TOOL_DEFS) {
    if (!definition.effects.spendsCredits) continue;
    const credits = creditsForToolInput(definition.name, { length: 8, tier: "low", mode: "prompt" });
    if (lookup.has(definition.name)) assert.equal(credits, null, definition.name);
    else assert.equal(typeof credits, "number", `${definition.name} ${credits}`);
  }
});
