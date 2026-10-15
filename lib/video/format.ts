import type { Fact } from "./schema";

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;

export const formatValue = (
  value: number,
  fact: Pick<Fact, "format" | "unitLabel">,
  withUnit = true,
) => {
  const unit = withUnit && fact.unitLabel ? ` ${fact.unitLabel}` : "";
  switch (fact.format) {
    case "percent":
      return `${trim(value)}%`;
    case "points":
      return `${value > 0 ? "+" : ""}${trim(value)} pts`;
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
      }).format(value);
    case "compact_currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    case "compact_number":
      return (
        new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value) + unit
      );
    case "number":
      return new Intl.NumberFormat("en-US").format(value) + unit;
  }
};

/** Keeps the precision the source used, without trailing float noise. */
const trim = (value: number) =>
  String(Number.parseFloat(value.toFixed(2)));

/** A number fact's value, or a series' latest point. */
export const formatFact = (fact: Fact, withUnit = true) => {
  if (fact.kind === "number" && fact.value !== null) {
    return formatValue(fact.value, fact, withUnit);
  }
  const last = fact.points?.at(-1);
  return last ? formatValue(last.value, fact, withUnit) : fact.label;
};

/**
 * Replaces `{fact_id}` placeholders with formatted source values. If the
 * text already says the unit right after the placeholder ("{sleep_hours} hours"),
 * the unit is left off the value so it doesn't read "7.5 hours hours".
 */
export const fillPlaceholders = (text: string, facts: Fact[]) => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  return text.replace(PLACEHOLDER, (match, id: string, offset: number) => {
    const fact = byId.get(id);
    if (!fact) return match;
    const after = text.slice(offset + match.length);
    const unitFollows =
      fact.unitLabel !== null &&
      new RegExp(`^\\s+${escapeRegExp(fact.unitLabel)}\\b`, "i").test(after);
    return formatFact(fact, !unitFollows);
  });
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const placeholderIds = (text: string) =>
  [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);

export const stripPlaceholders = (text: string) => text.replace(PLACEHOLDER, "");

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
