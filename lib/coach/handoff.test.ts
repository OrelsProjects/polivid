import assert from "node:assert/strict";
import test from "node:test";
import { saveCoachHandoff, skitPlanForChat, takeCoachHandoff } from "./handoff";

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  },
};

test("a handoff is picked up once, and a stale one is ignored", () => {
  saveCoachHandoff({ text: "Hello", characterId: "c1", characterName: "Orel" });
  assert.deepEqual(takeCoachHandoff(), { text: "Hello", characterId: "c1", characterName: "Orel" });
  assert.equal(takeCoachHandoff(), null, "taken once");
  saveCoachHandoff({ text: "Old" });
  assert.equal(takeCoachHandoff(Date.now() + 11 * 60 * 1000), null);
});

test("a skit plan goes to the chat with its script, settings and every shot, ready for a question", () => {
  const text = skitPlanForChat({
    script: "[waves] Hello there.",
    look: "Retro cartoon look",
    quality: "Low",
    seconds: 8,
    credits: 90,
    smooth: true,
    shots: [
      { say: "Hello there.", shot: "Quill waves from a tiny stage.", seconds: 5, sound: "small applause" },
      { say: "Bye.", shot: "Quill bows.", seconds: 3, sound: "" },
    ],
  });
  assert.match(text, /Script:\n\[waves\] Hello there\./);
  assert.match(text, /Plan: Retro cartoon look · Low quality · about 8 seconds \(the voice sets the exact length\) · 90 credits · smooth transitions on/);
  assert.match(text, /1\. 5s · sound: small applause\n {3}Line: Hello there\.\n {3}Shot: Quill waves from a tiny stage\./);
  assert.match(text, /2\. 3s · no sound/);
  assert.match(text, /make_skit_video/);
  assert.ok(text.endsWith("My question: "));
});
