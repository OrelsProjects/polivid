import { writeFile } from "node:fs/promises";
import { finishGeminiVideo, submitGeminiVideo } from "../lib/video/gemini-footage";

const main = async () => {
  const id = await submitGeminiVideo({
    model: "google/gemini-omni-1.1-flash",
    prompt: "A calm sea at sunrise, slow pan to the right. Gentle waves, no dialogue.",
    duration: 3,
    resolution: "360p",
    aspectRatio: "16:9",
  });
  console.log("Submitted", id);
  const started = Date.now();
  const bytes = await finishGeminiVideo(id, async () => true);
  await writeFile("/tmp/omni-test.mp4", bytes);
  console.log(`Saved ${bytes.byteLength} bytes in ${Math.round((Date.now() - started) / 1000)}s`);
};

void main();
