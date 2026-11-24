import { z } from "zod";

/** What one sketch-explainer beat draws on paper. */
export const SKETCH_KINDS = ["number", "bars", "steps", "compare", "words"] as const;
export type SketchKind = (typeof SKETCH_KINDS)[number];

export const SketchItemSchema = z.object({
  label: z.string().trim().min(1).max(32),
  /** Shown as written, such as "43%" or "10". Only numbers the person wrote survive. */
  value: z.string().trim().max(16).optional(),
});

export const SketchSchema = z.object({
  /** Two words, more or less, from the beat. */
  headline: z.string().trim().min(1).max(40),
  kind: z.enum(SKETCH_KINDS),
  items: z.array(SketchItemSchema).max(4),
});
export type Sketch = z.infer<typeof SketchSchema>;

const numbersIn = (text: string) => (text.match(/\d[\d,.]*/g) ?? []).map((value) => value.replace(/,/g, "").replace(/\.$/, ""));

/** True when every number in `text` appears in what the person wrote. */
const numbersFrom = (text: string, written: ReadonlySet<string>) => numbersIn(text).every((number) => written.has(number));

const MIN_ITEMS: Record<SketchKind, number> = { number: 1, bars: 2, steps: 2, compare: 2, words: 0 };

/**
 * Makes a suggested sketch follow the rules: a short headline, at most four items, and no number
 * on screen that the person didn't write. A chart that loses its numbers becomes a list of steps,
 * and a sketch with nothing left to draw becomes its headline alone.
 */
export const enforceSketch = (suggested: Partial<Sketch> | undefined, say: string, script: string): Sketch => {
  const written = new Set(numbersIn(script));
  const fallbackHeadline = say.replace(/[^\p{L}\p{N}\s'%-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 2).join(" ") || "Note";
  const headlineText = suggested?.headline?.trim() ?? "";
  const headline =
    headlineText && headlineText.split(/\s+/).length <= 4 && numbersFrom(headlineText, written) ? headlineText.slice(0, 40) : fallbackHeadline;
  let kind: SketchKind = suggested?.kind && (SKETCH_KINDS as readonly string[]).includes(suggested.kind) ? suggested.kind : "words";
  const items = (suggested?.items ?? [])
    .slice(0, 4)
    .map((item) => ({ label: String(item?.label ?? "").trim().slice(0, 32), value: item?.value?.trim().slice(0, 16) || undefined }))
    .filter((item) => item.label && numbersFrom(item.label, written))
    .map((item): { label: string; value?: string } =>
      item.value && (numbersIn(item.value).length === 0 || !numbersFrom(item.value, written)) ? { label: item.label } : item,
    );
  const valued = items.filter((item) => item.value);
  if ((kind === "number" || kind === "bars") && valued.length < MIN_ITEMS[kind]) kind = items.length >= 2 ? "steps" : "words";
  const kept = kind === "number" || kind === "bars" ? valued : items.map((item) => ({ label: item.label }));
  if (kept.length < MIN_ITEMS[kind]) return { headline, kind: "words", items: [] };
  return { headline, kind, items: kind === "number" ? kept.slice(0, 1) : kept };
};
