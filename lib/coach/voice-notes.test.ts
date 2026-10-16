import assert from "node:assert/strict";
import test from "node:test";
import { proseWithoutVoiceNote, voiceChoiceLabel, voiceFromMessages, voiceFromNote, voiceNote } from "./voice-notes";

const saved = "11111111-2222-3333-4444-555555555555";

test("character notes round-trip a choice and let a later off win", () => {
  assert.equal(voiceFromNote(voiceNote("studio")), "studio");
  assert.equal(voiceFromNote(voiceNote(saved, "Maya Cohen")), saved);
  assert.equal(proseWithoutVoiceNote(`Make the reel.\n${voiceNote("studio")}`), "Make the reel.");
  assert.equal(voiceChoiceLabel(voiceNote("studio")), "Studio narrator");
  assert.equal(voiceChoiceLabel(voiceNote("off")), "");
  assert.equal(voiceChoiceLabel(voiceNote(saved, "Maya Cohen")), "Maya Cohen");
  assert.equal(voiceChoiceLabel(voiceNote(saved)), "Saved character");

  const voice = voiceFromMessages([
    { role: "user", parts: [{ type: "text", text: voiceNote("studio") }] },
    { role: "assistant", parts: [{ type: "text", text: voiceNote(saved) }] },
    { role: "user", parts: [{ type: "text", text: voiceNote("off") }] },
  ]);
  assert.equal(voice, "off");
});

test("older voice notes still read as a character", () => {
  const legacy = `Make the reel.\nAttached voice: ${saved}`;
  assert.equal(voiceFromNote(legacy), saved);
  assert.equal(proseWithoutVoiceNote(legacy), "Make the reel.");
});
