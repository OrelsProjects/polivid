import assert from "node:assert/strict";
import test from "node:test";
import { BRIEF_APPROVAL_TEXT, briefNeedsApproval, hasApprovableBrief, isBriefApprovalMessage, splitCoachContent } from "./brief-blocks";

test("splitCoachContent extracts a fenced brief", () => {
  const { prose, brief } = splitCoachContent(`Here's a plan.

\`\`\`brief
mode: prompt
format: 9:16
length: 30
tier: pro
preset: pixar
hook: A kid drops a backpack
beats: open on the drop | cut to the clock | end on the CTA
vo: Speak at 160 wpm
cta: Follow for more
\`\`\`

Want me to generate it?`);

  assert.match(prose, /Here's a plan/);
  assert.match(prose, /Want me to generate/);
  assert.ok(brief);
  assert.equal(brief.mode, "prompt");
  assert.equal(brief.format, "9:16");
  assert.equal(brief.length, "30");
  assert.equal(brief.preset, "pixar");
  assert.equal(brief.hook, "A kid drops a backpack");
  assert.deepEqual(brief.beats, ["open on the drop", "cut to the clock", "end on the CTA"]);
  assert.equal(brief.cta, "Follow for more");
});

test("a brief drops placeholder values like none", () => {
  const { brief } = splitCoachContent("```brief\nmode: prompt\nvo: none\ncta: N/A\nhook: A cat rolls in\n```");
  assert.equal(brief?.vo, "");
  assert.equal(brief?.cta, "");
  assert.equal(brief?.hook, "A cat rolls in");
});

test("Approve shows only under an assistant brief that nothing has queued yet", () => {
  const brief = { type: "text", text: "Plan:\n```brief\nmode: prompt\n```" };
  assert.equal(hasApprovableBrief({ role: "assistant", parts: [brief] }), true);
  assert.equal(hasApprovableBrief({ role: "user", parts: [brief] }), false);
  assert.equal(hasApprovableBrief({ role: "assistant", parts: [{ type: "text", text: "No brief here." }] }), false);
  assert.equal(hasApprovableBrief({ role: "assistant", parts: [brief, { type: "tool-create_video" }] }), false);
  assert.equal(hasApprovableBrief({ role: "assistant", parts: [brief, { type: "tool-make_prompt_video" }] }), false);
  assert.equal(hasApprovableBrief({ role: "assistant", parts: [brief, { type: "tool-generate_image" }] }), false);
});

test("a short brief does not need approval and a 30 second pro brief does", () => {
  const { brief: short } = splitCoachContent("```brief\nmode: prompt\nlength: 5\ntier: pro\n```");
  const { brief: full } = splitCoachContent("```brief\nmode: prompt\nlength: 30\ntier: pro\n```");
  const { brief: graphics } = splitCoachContent("```brief\nmode: motion-graphics\nlength: 30\ntier: ultra\n```");
  assert.ok(short && full && graphics);
  assert.equal(briefNeedsApproval(short), false);
  assert.equal(briefNeedsApproval(full), true);
  assert.equal(briefNeedsApproval(graphics), false);
});

test("the approval line is hidden from the chat", () => {
  assert.equal(
    isBriefApprovalMessage({
      role: "user",
      parts: [{ type: "text", text: BRIEF_APPROVAL_TEXT }, { type: "text", text: "Attached character: off" }],
    }),
    true,
  );
  assert.equal(isBriefApprovalMessage({ role: "user", parts: [{ type: "text", text: "Make it shorter." }] }), false);
});

test("splitCoachContent returns prose only when there is no fence", () => {
  const { prose, brief } = splitCoachContent("Just a question about presets.");
  assert.equal(prose, "Just a question about presets.");
  assert.equal(brief, null);
});
