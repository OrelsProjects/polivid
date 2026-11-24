import type { LayoutBeat } from "./beats";
import type { LayoutMedia, LayoutName, LayoutStyle } from "./styles";

/** What one beat shows. The planner suggests it, and `enforcePlan` makes it follow the style. */
export interface BeatPlan {
  layout: LayoutName;
  /** Index into the person's uploads, when this beat shows one of them. */
  upload?: number;
  /** What to draw, when this beat shows a picture and no upload. */
  picture?: string;
  /** One word from the beat's own words, drawn in the highlight color. */
  highlight?: string;
  /** A short figure, shown as a pill. Only numbers the person wrote survive. */
  stat?: string;
}

/** Layouts that show a picture or an upload. */
export const SHOWS_PICTURE: ReadonlySet<LayoutName> = new Set(["split", "picture", "card", "bubble", "window"]);

const normalizeNumber = (value: string) => value.replace(/,/g, "").replace(/\.$/, "");

/** Every number in `text`, without thousands separators. */
const numbersIn = (text: string) => (text.match(/\d[\d,.]*/g) ?? []).map(normalizeNumber);

/**
 * A stat survives only when it has a number and every number in it appears in what the person
 * wrote. The model may shorten a line into a stat, but it may not make a figure up.
 */
export const statFromScript = (stat: string | undefined, script: string) => {
  const text = stat?.trim().slice(0, 40);
  if (!text) return undefined;
  const numbers = numbersIn(text);
  if (numbers.length === 0) return undefined;
  const written = new Set(numbersIn(script));
  return numbers.every((number) => written.has(number)) ? text : undefined;
};

/** A highlight survives only as a word, or short phrase, the beat actually says. */
export const highlightFromBeat = (highlight: string | undefined, say: string) => {
  const text = highlight?.trim().replace(/^["'“”]+|["'“”.,!?;:]+$/g, "");
  if (!text || text.split(/\s+/).length > 3) return undefined;
  const words = ` ${say.toLowerCase().replace(/[^\p{L}\p{N}%$'\s-]/gu, " ")} `;
  return words.includes(` ${text.toLowerCase()} `) ? text : undefined;
};

const seconds = (beat: LayoutBeat) => Math.max(0, beat.end - beat.start);

/** Uploads that can sit in a layout: still pictures for split and card, videos too for full-frame and window. */
const uploadFits = (layout: LayoutName, media: LayoutMedia) => {
  if (layout === "card") return media.kind === "image" && (media.role === "post" || media.role === "screenshot");
  if (layout === "window") return media.role === "recording" || media.role === "screenshot";
  if (layout === "bubble") return media.role === "post" || media.role === "screenshot" || media.role === "recording";
  return layout === "split" || layout === "picture";
};

/**
 * Makes a planner's suggestion follow the style's rules. Nothing here trusts the model:
 * the layout, the uploads, the highlight, and the stat are all checked against the beats,
 * the uploads, and the script, and fixed when they break a rule.
 */
export const enforcePlan = (input: {
  style: LayoutStyle;
  beats: readonly LayoutBeat[];
  suggested: readonly Partial<BeatPlan>[];
  media: readonly LayoutMedia[];
  script: string;
}): BeatPlan[] => {
  const { style, beats, media, script } = input;
  const fallback = style.layouts[0];
  const plans: BeatPlan[] = beats.map((beat, index) => {
    const suggested = input.suggested[index] ?? {};
    const layout = suggested.layout && style.layouts.includes(suggested.layout) ? suggested.layout : fallback;
    return {
      layout,
      upload: typeof suggested.upload === "number" ? suggested.upload : undefined,
      picture: suggested.picture?.trim() || undefined,
      highlight: highlightFromBeat(suggested.highlight, beat.say),
      stat: statFromScript(suggested.stat, script),
    };
  });

  if (style.id === "split-presenter") enforceSplitPresenter(plans, beats);

  assignUploads(plans, media);
  for (const [index, plan] of plans.entries()) {
    // A layout that needs an upload it doesn't have falls back to the style's default.
    if ((plan.layout === "card" || plan.layout === "window") && plan.upload === undefined) plan.layout = fallback;
    if (!SHOWS_PICTURE.has(plan.layout)) {
      plan.upload = undefined;
      plan.picture = undefined;
    } else if (plan.upload === undefined && !plan.picture) {
      plan.picture = `A clear, well-composed picture that shows the idea of this line: ${beats[index].say}`;
    }
  }
  return plans;
};

/**
 * Split presenter: the hook and the call to action are close-ups, and close-ups take about a
 * fifth of the runtime. Two middle close-ups never sit back to back.
 */
const enforceSplitPresenter = (plans: BeatPlan[], beats: readonly LayoutBeat[]) => {
  const last = plans.length - 1;
  plans[0].layout = "avatar-close";
  if (last > 0) plans[last].layout = "avatar-close";
  const total = beats.reduce((sum, beat) => sum + seconds(beat), 0);
  const budget = total * 0.25;
  let used = seconds(beats[0]) + (last > 0 ? seconds(beats[last]) : 0);
  for (let index = 1; index < last; index += 1) {
    const plan = plans[index];
    if (plan.layout !== "avatar-close") continue;
    const crowded = plans[index - 1].layout === "avatar-close" || plans[index + 1]?.layout === "avatar-close";
    if (crowded || used + seconds(beats[index]) > budget) {
      plan.layout = "split";
      continue;
    }
    used += seconds(beats[index]);
  }
};

/**
 * Each upload is used once, where it fits. A beat the planner gave an upload keeps it when it fits.
 * Uploads nobody placed go to picture beats first, so nothing is drawn while one is unused.
 */
const assignUploads = (plans: BeatPlan[], media: readonly LayoutMedia[]) => {
  const used = new Set<number>();
  for (const plan of plans) {
    const index = plan.upload;
    plan.upload = undefined;
    if (index === undefined || used.has(index) || !media[index] || !uploadFits(plan.layout, media[index])) continue;
    plan.upload = index;
    used.add(index);
  }
  for (const plan of plans) {
    if (plan.upload !== undefined || !SHOWS_PICTURE.has(plan.layout)) continue;
    const free = media.findIndex((item, index) => !used.has(index) && uploadFits(plan.layout, item));
    if (free < 0) continue;
    plan.upload = free;
    used.add(free);
  }
};
