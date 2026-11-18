/**
 * Builds the worker's environment file from .env, then .env.local, then .env.worker (later files win).
 * .env.worker is for values that differ in production, e.g. AUTH_SECRET and APP_PUBLIC_URL.
 *
 *   node scripts/worker-env.mjs <output-file>
 *
 * Writes KEY='value' lines, which both systemd and bash read without expanding anything.
 * Prints key names only, never values.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";

const out = process.argv[2];
if (!out) {
  console.error("Usage: node scripts/worker-env.mjs <output-file>");
  process.exit(1);
}

/** Only the website uses these. */
const WEB_ONLY = [/^AUTH_GOOGLE_/, /^STRIPE_/];
const DEFAULTS = { APP_PUBLIC_URL: "https://www.polivid.ai" };
/** The site checks asset links the worker signs, so the worker must sign with production's secret. */
const MUST_MATCH_PRODUCTION = ["AUTH_SECRET", "APP_PUBLIC_URL"];

const merged = { ...DEFAULTS };
const fromWorkerFile = new Set();
for (const file of [".env", ".env.local", ".env.worker"]) {
  if (!existsSync(file)) continue;
  const values = parse(readFileSync(file));
  for (const [key, value] of Object.entries(values)) {
    if (value === "") continue;
    merged[key] = value;
    if (file === ".env.worker") fromWorkerFile.add(key);
  }
}

const lines = [];
for (const [key, value] of Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))) {
  if (WEB_ONLY.some((pattern) => pattern.test(key))) continue;
  if (value.includes("'") || value.includes("\n")) {
    console.error(`${key} contains a quote or a newline, which the env file can't hold. Remove it or set it in .env.worker.`);
    process.exit(1);
  }
  lines.push(`${key}='${value}'`);
}
writeFileSync(out, `${lines.join("\n")}\n`, { mode: 0o600 });

const keys = lines.map((line) => line.slice(0, line.indexOf("=")));
console.log(`Worker env: ${keys.length} keys: ${keys.join(", ")}`);
const unconfirmed = MUST_MATCH_PRODUCTION.filter((key) => !fromWorkerFile.has(key));
if (unconfirmed.length > 0) {
  console.log(`Not set in .env.worker, so taken from local files or defaults: ${unconfirmed.join(", ")}. Editor exports need these to match production.`);
}
