import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCatalogMarkdown } from "../lib/tools/describe";

const path = join(dirname(fileURLToPath(import.meta.url)), "../docs/tools/CATALOG.md");
writeFileSync(path, renderCatalogMarkdown());
console.log(`Wrote ${path}`);
