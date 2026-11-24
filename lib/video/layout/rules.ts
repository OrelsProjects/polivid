import type { LayoutBeat } from "./beats";
import { enforceSketch, type Sketch } from "./sketch";
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
  /** What a sketch-explainer beat draws. */
  sketch?: Sketch;
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
      ...(style.id === "sketch-explainer" ? { sketch: enforceSketch(suggested.sketch, beat.say, script) } : {}),
    };
  });

  if (style.id === "split-presenter") enforceSplitPresenter(plans, beats);
  if (style.id === "punch-in") enforcePunchIn(plans, beats);
  if (style.id === "source-reader") enforceSourceReader(plans, media);
  if (style.id === "framed-post") enforceFramedPost(plans);
  if (style.id === "screen-demo") enforceScreenDemo(plans);

  assignUploads(plans, media, REUSES_UPLOAD.has(style.id));
  for (const [index, plan] of plans.entries()) {
    // A layout that needs an upload it doesn't have falls back: a card to the style's default, and a
    // screen window or a post bubble to the speaker, since those styles never draw a picture.
    if (plan.upload === undefined && plan.layout === "card") plan.layout = fallback;
    if (plan.upload === undefined && (plan.layout === "window" || plan.layout === "bubble")) plan.layout = "avatar";
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
 * Punch-in: the take the whole way, cutting between normal and close at each sentence. A picture is a
 * short cutaway, never two in a row, and at most about a quarter of the beats.
 */
const enforcePunchIn = (plans: BeatPlan[], beats: readonly LayoutBeat[]) => {
  let cutaways = 0;
  let close = false;
  for (const [index, plan] of plans.entries()) {
    const canCut =
      plan.layout === "picture" &&
      index > 0 &&
      index < plans.length - 1 &&
      plans[index - 1].layout !== "picture" &&
      cutaways < Math.max(1, Math.floor(beats.length / 4));
    if (canCut) {
      cutaways += 1;
      continue;
    }
    plan.layout = close ? "avatar-close" : "avatar";
    close = !close;
  }
};

/**
 * Source reader: the post fills the frame with the speaker in a bubble while it is read, and the
 * speaker's own take follows on camera. The last beat is always the speaker. With no word from the
 * planner, the first two-fifths read the post.
 */
const enforceSourceReader = (plans: BeatPlan[], media: readonly LayoutMedia[]) => {
  const hasPost = media.some((item) => item.role === "post" || item.role === "screenshot");
  const planned = plans.some((plan) => plan.layout === "bubble");
  const reading = Math.max(1, Math.ceil(plans.length * 0.4));
  for (const [index, plan] of plans.entries()) {
    if (!hasPost || index === plans.length - 1) plan.layout = "avatar";
    else if (!planned) plan.layout = index < reading ? "bubble" : "avatar";
    else if (plan.layout !== "bubble") plan.layout = "avatar";
  }
  if (hasPost && plans.length > 1 && !plans.some((plan) => plan.layout === "bubble")) plans[0].layout = "bubble";
};

/** Framed post: the band the whole way, ending on a full-frame card that carries the call to action. */
const enforceFramedPost = (plans: BeatPlan[]) => {
  for (const plan of plans) plan.layout = "framed";
  if (plans.length > 1) plans[plans.length - 1].layout = "endcard";
};

/** Screen demo: a close-up for the hook, then the screen in a window for everything after. */
const enforceScreenDemo = (plans: BeatPlan[]) => {
  for (const [index, plan] of plans.entries()) plan.layout = index === 0 && plans.length > 1 ? "avatar-close" : "window";
};

/** Styles that keep one upload on screen across several beats: a post being read, a recording playing on. */
const REUSES_UPLOAD: ReadonlySet<string> = new Set(["source-reader", "screen-demo"]);

/**
 * Each upload is used once, where it fits. A beat the planner gave an upload keeps it when it fits.
 * Uploads nobody placed go to picture beats first, so nothing is drawn while one is unused.
 * In styles that hold an upload across beats, a beat with nothing new keeps the one before it.
 */
const assignUploads = (plans: BeatPlan[], media: readonly LayoutMedia[], reuse = false) => {
  const used = new Set<number>();
  for (const plan of plans) {
    const index = plan.upload;
    plan.upload = undefined;
    if (index === undefined || used.has(index) || !media[index] || !uploadFits(plan.layout, media[index])) continue;
    plan.upload = index;
    used.add(index);
  }
  let last: number | undefined;
  for (const plan of plans) {
    if (!SHOWS_PICTURE.has(plan.layout)) continue;
    if (plan.upload !== undefined) {
      last = plan.upload;
      continue;
    }
    // A post keeps being read, and a recording keeps playing, until the next upload or the speaker.
    if (reuse && last !== undefined && uploadFits(plan.layout, media[last])) {
      plan.upload = last;
      continue;
    }
    const free = media.findIndex((item, index) => !used.has(index) && uploadFits(plan.layout, item));
    const fallback = reuse ? media.findIndex((item) => uploadFits(plan.layout, item)) : -1;
    const pick = free >= 0 ? free : fallback;
    if (pick < 0) continue;
    plan.upload = pick;
    used.add(pick);
    last = pick;
  }
};
