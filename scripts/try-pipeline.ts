/**
 * Runs script generation from the terminal, without the app, auth or database.
 *
 *   npm run try -- "Why sleep matters for memory"
 *
 * Needs OPENROUTER_API_KEY in .env or .env.local. One model call per run.
 */
import { MODEL } from "@/lib/ai/openrouter";
import { normalizePlan, writeScript } from "@/lib/video/pipeline";

async function main() {
  const prompt = process.argv.slice(2).join(" ").trim() || "Why sleep matters for memory";
  console.log(`Model: ${MODEL}\nPrompt: ${prompt}\n`);

  const started = Date.now();
  const plan = normalizePlan(await writeScript({ prompt, format: "9:16", length: 60, model: MODEL }), 60);
  console.log(`Script (${((Date.now() - started) / 1000).toFixed(1)}s): ${plan.title}\n`);
  for (const [i, scene] of plan.scenes.entries()) {
    console.log(`  ${i + 1}. [${scene.type} ${scene.durationSec}s] ${scene.headline}`);
    console.log(`     ${scene.narration}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
