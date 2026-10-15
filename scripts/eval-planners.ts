/**
 * Compare Claude and OpenAI planner configs on representative scripts.
 *
 *   EVAL_BUDGET_USD=2 npm run eval:planners
 *
 * Hard-stops when estimated spend reaches EVAL_BUDGET_USD.
 */
import { createOpenRouterPlanner } from "../lib/production/planner/openrouter-planner";
import { DEVELOP_INSTRUCTIONS, formatDevelopInput } from "../lib/production/prompts";
import { DevelopOutputSchema } from "../lib/production/schema";
import { validateDevelop } from "../lib/production/validate";

const CASES = [
  { name: "vague", text: "A woman cannot decide whether to open a letter." },
  { name: "script", text: "[SCRIPT]\nEXACT: Maya: I can't keep doing this.\nShe opens the door." },
];

const budget = Number(process.env.EVAL_BUDGET_USD ?? "1");

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("Set OPENROUTER_API_KEY to run paid planner eval.");
    return;
  }
  const planner = createOpenRouterPlanner();
  let spent = 0;
  for (const provider of ["claude", "openai"] as const) {
    process.env.PLANNER_PROVIDER = provider;
    for (const testCase of CASES) {
      if (spent >= budget) {
        console.log(`Stopped at $${spent.toFixed(3)} (budget $${budget}).`);
        return;
      }
      const started = Date.now();
      const result = await planner.run({
        task: "develop",
        schema: DevelopOutputSchema,
        system: DEVELOP_INSTRUCTIONS,
        input: formatDevelopInput({
          text: testCase.text,
          format: "9:16",
          durationSec: 30,
          language: "en",
          delegated: true,
        }),
      });
      spent += result.usage.usd;
      const validation = validateDevelop(result.output);
      console.log(
        [
          provider,
          testCase.name,
          result.model,
          `ok=${validation.ok}`,
          `repairs=${result.repaired ? 1 : 0}`,
          `${((Date.now() - started) / 1000).toFixed(1)}s`,
          `$${result.usage.usd.toFixed(3)}`,
          result.output.classification,
          `scenes=${result.output.script.scenes.length}`,
        ].join("  "),
      );
    }
  }
  console.log(`Total $${spent.toFixed(3)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
