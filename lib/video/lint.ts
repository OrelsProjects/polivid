import { placeholderIds, stripPlaceholders } from "./format";
import type { Fact, ScenePlan, SearchSource, SourcedQuote } from "./schema";

/** Four-digit years are the only digits allowed outside placeholders. */
const YEAR = /\b(19|20)\d{2}\b/g;
const DIGIT = /\d/;

export interface LintResult {
  errors: string[];
  /** Facts whose source URL never came back from the web search. */
  unverifiedFactIds: string[];
}

/**
 * Deterministic checks on an LLM scene plan. Any number on screen or in the
 * narration must come from a fact placeholder, so a plan that types a digit
 * itself is rejected.
 */
export const lintPlan = (
  plan: ScenePlan,
  facts: Fact[],
  quotes: SourcedQuote[],
  searchSources: SearchSource[],
): LintResult => {
  const errors: string[] = [];
  const byId = new Map(facts.map((f) => [f.id, f]));
  const knownQuotes = new Set(quotes.map((q) => normalizeText(q.text)));

  if (plan.scenes.length < 2) errors.push("Plan needs at least 2 scenes.");
  if (DIGIT.test(stripYears(plan.title))) {
    errors.push(`Title contains a raw number: "${plan.title}"`);
  }

  plan.scenes.forEach((scene, i) => {
    const where = `Scene ${i + 1} (${scene.type})`;

    for (const [field, text] of [
      ["headline", scene.headline],
      ["narration", scene.narration],
    ] as const) {
      if (DIGIT.test(stripYears(stripPlaceholders(text)))) {
        errors.push(`${where} ${field} types a number instead of using a {fact_id}: "${text}"`);
      }
      for (const id of placeholderIds(text)) {
        if (!byId.has(id)) errors.push(`${where} ${field} uses unknown fact {${id}}.`);
      }
    }

    for (const id of scene.factIds) {
      if (!byId.has(id)) errors.push(`${where} references unknown fact "${id}".`);
    }
    const used = scene.factIds.map((id) => byId.get(id)).filter((f) => f !== undefined);

    switch (scene.type) {
      case "hook":
      case "text":
      case "footage":
        if (!scene.headline.trim() || !scene.narration.trim()) {
          errors.push(`${where} needs a headline and narration.`);
        }
        break;
      case "big_number":
        if (used.length !== 1 || used[0].kind !== "number") {
          errors.push(`${where} needs exactly one number fact.`);
        }
        break;
      case "line":
        if (used.length !== 1 || used[0].kind !== "series" || (used[0].points?.length ?? 0) < 2) {
          errors.push(`${where} needs one series fact with at least 2 points.`);
        }
        break;
      case "bars": {
        const oneSeries = used.length === 1 && used[0].kind === "series";
        const manyNumbers = used.length >= 2 && used.every((f) => f.kind === "number");
        if (!oneSeries && !manyNumbers) {
          errors.push(`${where} needs one series fact or 2+ number facts.`);
        }
        break;
      }
      case "quote":
        if (!scene.quote?.text.trim()) {
          errors.push(`${where} is missing its quote.`);
        } else if (!knownQuotes.has(normalizeText(scene.quote.text))) {
          errors.push(`${where} quote is not one of the researched verbatim quotes.`);
        }
        break;
    }
  });

  const searched = new Set(searchSources.map((s) => normalizeUrl(s.url)));
  const unverifiedFactIds =
    searched.size === 0
      ? []
      : facts.filter((f) => !searched.has(normalizeUrl(f.sourceUrl))).map((f) => f.id);

  return { errors, unverifiedFactIds };
};

const stripYears = (text: string) => text.replace(YEAR, "");

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[“”"‘’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeUrl = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
};
