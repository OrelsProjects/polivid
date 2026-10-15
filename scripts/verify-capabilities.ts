/**
 * Checks which production models are listed by the configured providers.
 *
 *   npm run verify:capabilities
 */
import { CAPABILITIES } from "../lib/production/capabilities";

const openrouterIds = async () => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return new Set<string>();
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`OpenRouter models failed (${response.status}).`);
  const json = (await response.json()) as { data?: { id?: string }[] };
  return new Set((json.data ?? []).map((model) => model.id ?? "").filter(Boolean));
};

async function main() {
  const listed = await openrouterIds();
  console.log(`Verified ${new Date().toISOString().slice(0, 10)}. OpenRouter models loaded: ${listed.size}`);
  for (const capability of CAPABILITIES) {
    const onRouter = listed.size === 0 ? "skipped" : listed.has(capability.modelId) ? "listed" : "missing";
    console.log(
      `${capability.id.padEnd(22)} ${capability.route.padEnd(12)} ${capability.modelId}  ${capability.route === "openrouter" ? onRouter : "direct"}  verified ${capability.verifiedAt}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
