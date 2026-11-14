import assert from "node:assert/strict";
import test from "node:test";
import { MIN_VOICE_DESCRIPTION } from "@/lib/characters/constants";
import { DESIGN_PREVIEW_LINE } from "./constants";

// ElevenLabs text-to-voice/design returns 422 below these lengths.
test("the voice design sample is long enough for the voice service", () => {
  assert.ok(DESIGN_PREVIEW_LINE.length >= 100 && DESIGN_PREVIEW_LINE.length <= 1000, String(DESIGN_PREVIEW_LINE.length));
  assert.ok(MIN_VOICE_DESCRIPTION >= 20);
});
