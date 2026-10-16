import "server-only";
import { MAX_SAMPLE_BYTES, SAMPLE_PROMPTS, audioSampleType } from "@/lib/voice/constants";

const asString = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export const readCharacterForm = (form: FormData) => {
  const samples = form.getAll("samples").filter((entry): entry is File => entry instanceof File);
  return {
    name: asString(form.get("name")),
    imageKey: asString(form.get("imageKey")),
    imagePrompt: asString(form.get("imagePrompt")),
    voiceMode: asString(form.get("voiceMode")) || "none",
    generatedVoiceId: asString(form.get("generatedVoiceId")),
    voiceDescription: asString(form.get("voiceDescription")),
    keepVoice: asString(form.get("keepVoice")) === "yes",
    consent: asString(form.get("consent")),
    samples,
  };
};

export const sampleFiles = async (samples: File[]) => {
  if (samples.length !== SAMPLE_PROMPTS.length) {
    throw new Error(`Record all ${SAMPLE_PROMPTS.length} parts.`);
  }
  const files = [];
  for (const sample of samples) {
    if (sample.size > MAX_SAMPLE_BYTES) throw new Error("Keep each take under thirty seconds.");
    if (!audioSampleType(sample.type, sample.name)) throw new Error("Each part needs to be an audio recording.");
    files.push({
      bytes: new Uint8Array(await sample.arrayBuffer()),
      type: sample.type,
      name: sample.name,
    });
  }
  return files;
};
