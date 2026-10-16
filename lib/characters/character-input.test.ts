import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_PROMPTS } from "@/lib/voice/constants";
import { parseCharacterFields, recordedSamplesProblem } from "./input";

test("a character needs a name and a picture", () => {
  assert.throws(() => parseCharacterFields({ name: "A", imageKey: "uploads/u/a.png" }), /name/);
  assert.throws(() => parseCharacterFields({ name: "Maya", imageKey: "" }), /picture/);
  const fields = parseCharacterFields({ name: "Maya", imageKey: "uploads/u/a.png", voiceMode: "none" });
  assert.equal(fields.name, "Maya");
  assert.equal(fields.imageKey, "uploads/u/a.png");
  assert.equal(fields.voiceMode, "none");
});

test("a designed voice needs a preview and a description", () => {
  assert.throws(
    () => parseCharacterFields({ name: "Maya", imageKey: "uploads/u/a.png", voiceMode: "designed" }),
    /designed/,
  );
  assert.throws(
    () =>
      parseCharacterFields({
        name: "Maya",
        imageKey: "uploads/u/a.png",
        voiceMode: "designed",
        generatedVoiceId: "gen_1",
        voiceDescription: "short",
      }),
    /Describe/,
  );
  const fields = parseCharacterFields({
    name: "Maya",
    imageKey: "uploads/u/a.png",
    voiceMode: "designed",
    generatedVoiceId: "gen_1",
    voiceDescription: "A calm news voice",
  });
  assert.equal(fields.generatedVoiceId, "gen_1");
});

test("recorded samples need every part", () => {
  assert.match(recordedSamplesProblem([]) ?? "", /Record all/);
  const take = (index: number) => ({ size: 8_000, type: "audio/webm", name: `${index}.webm` });
  assert.match(recordedSamplesProblem([take(0), take(1), take(2)]) ?? "", /Record all/);
  assert.equal(recordedSamplesProblem(SAMPLE_PROMPTS.map((_, index) => take(index))), null);
});
