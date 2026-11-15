import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Tool handlers run for MCP clients and the Coach, where there is no browser session.
// Helpers that read the signed-in user (getCurrentUser, list/getMy*) redirect to /login there.
const SESSION_ONLY = /\b(getCurrentUser|listMy[A-Z]\w*|getMy[A-Z]\w*|saveMyProject|deleteMyProject|revertMyProject|createBlankProject|createProjectFromVideo)\s*\(/;

test("tool handlers never use helpers that need a browser session", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const offenders = readdirSync(dir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .flatMap((file) =>
      readFileSync(join(dir, file), "utf8")
        .split("\n")
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter((row) => SESSION_ONLY.test(row.text)),
    )
    .map((row) => `${row.file}:${row.line} ${row.text.trim()}`);
  assert.deepEqual(offenders, []);
});
