import { MAX_REFERENCE_IMAGES } from "@/lib/video/schema";
import { planSegments } from "@/lib/video/segments";

/** One cut per second, and never more than this, so a long video cannot ask for hundreds of clips. */
export const MAX_CUTS = 60;
export const MAX_CUT_CAMERA = 200;

export const MAX_BRIEF_LINE = 500;
export const MAX_DIRECTOR_LINE = 800;

/** What an uploaded picture is for. The planner assigns these; the user does not label them. */
export const ATTACHMENT_ROLES = ["subject", "person", "product", "location", "framing"] as const;
export type AttachmentRole = (typeof ATTACHMENT_ROLES)[number];

/** Subject and people stay ahead of the place, which stays ahead of framing references. */
const ROLE_ORDER: readonly AttachmentRole[] = ["subject", "person", "product", "location", "framing"];

export interface ShotCut {
  seconds: number;
  camera: string;
  /** 1-based attachment indexes for this shot. Missing means every attachment. */
  images?: number[];
}

export interface PromptBrief {
  subject: string;
  setting: string;
  director: string;
  style: string;
  mustKeep: string;
  mustAvoid: string;
}

export interface AttachmentAssignment {
  index: number;
  role: AttachmentRole;
}

export interface PromptShotPlan {
  brief: PromptBrief;
  attachmentRoles: AttachmentAssignment[];
  cuts: ShotCut[];
}

export const emptyPromptBrief = (): PromptBrief => ({
  subject: "",
  setting: "",
  director: "",
  style: "",
  mustKeep: "",
  mustAvoid: "",
});

export const isAttachmentRole = (value: string | undefined): value is AttachmentRole =>
  Boolean(value && (ATTACHMENT_ROLES as readonly string[]).includes(value));

const cleanCamera = (camera: string | undefined) =>
  (camera ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CUT_CAMERA);

const cleanImages = (images: readonly number[] | undefined): number[] | undefined => {
  if (!images || images.length === 0) return undefined;
  const next: number[] = [];
  for (const image of images) {
    const index = Math.round(image);
    if (!Number.isInteger(index) || index < 1 || index > MAX_REFERENCE_IMAGES || next.includes(index)) continue;
    next.push(index);
  }
  return next.length > 0 ? next : undefined;
};

const withImages = (seconds: number, camera: string, images: number[] | undefined): ShotCut =>
  images && images.length > 0 ? { seconds, camera, images } : { seconds, camera };

/**
 * Makes the cuts add up to `length`. A long or short list is fixed by changing the last cut.
 * More than one cut per second, or more than {@link MAX_CUTS}, is dropped from the end first.
 * A cut longer than `maxSeconds` is split so one clip can film it.
 */
export const normalizeCuts = (
  cuts: readonly { seconds: number; camera?: string; images?: number[] }[],
  length: number,
  maxSeconds?: number,
): ShotCut[] => {
  const target = Math.max(1, Math.round(length));
  const cap = Math.min(MAX_CUTS, target);
  const limit = maxSeconds && maxSeconds >= 1 ? Math.min(target, Math.floor(maxSeconds)) : target;
  const cleaned: ShotCut[] = [];
  for (const cut of cuts) {
    const seconds = Math.round(cut.seconds);
    if (!Number.isInteger(seconds) || seconds < 1) continue;
    cleaned.push(withImages(seconds, cleanCamera(cut.camera), cleanImages(cut.images)));
    if (cleaned.length >= cap) break;
  }
  const fitted = (cleaned.length > 0 ? cleaned : [{ seconds: target, camera: "" }]).map((cut) => ({ ...cut }));
  let total = fitted.reduce((sum, cut) => sum + cut.seconds, 0);
  while (total > target && fitted.length > 1) {
    const last = fitted[fitted.length - 1]!;
    const overflow = total - target;
    if (last.seconds - overflow >= 1) {
      last.seconds -= overflow;
      total = target;
      break;
    }
    total -= last.seconds;
    fitted.pop();
  }
  if (fitted.length === 1) fitted[0]!.seconds = target;
  else if (total < target) fitted[fitted.length - 1]!.seconds += target - total;

  let extra = fitted[fitted.length - 1]!.seconds - limit;
  if (extra > 0) {
    fitted[fitted.length - 1]!.seconds = limit;
    for (let index = fitted.length - 2; index >= 0 && extra > 0; index -= 1) {
      const room = limit - fitted[index]!.seconds;
      if (room <= 0) continue;
      const give = Math.min(room, extra);
      fitted[index]!.seconds += give;
      extra -= give;
    }
    if (extra > 0) fitted[fitted.length - 1]!.seconds += extra;
  }

  const pieces: ShotCut[] = [];
  for (const cut of fitted) {
    let left = cut.seconds;
    while (left > 0) {
      const room = cap - pieces.length;
      if (room <= 1 || left <= limit) {
        if (room >= 1) pieces.push(withImages(left, cut.camera, cut.images));
        else pieces[pieces.length - 1]!.seconds += left;
        break;
      }
      pieces.push(withImages(limit, cut.camera, cut.images));
      left -= limit;
    }
  }
  return pieces.length > 0 ? pieces : [{ seconds: target, camera: "" }];
};

/**
 * Changes one cut's on-screen length. Later cuts give or take the difference
 * first, then earlier ones, so the shots still add up to `length`.
 * No cut drops below 1 second or rises above `maxSeconds`, and the order stays put.
 */
export const retimeCut = (
  cuts: readonly { seconds: number; camera?: string; images?: number[] }[],
  index: number,
  seconds: number,
  length: number,
  maxSeconds?: number,
): ShotCut[] => {
  const fitted = normalizeCuts(cuts, length, maxSeconds).map((cut) => ({ ...cut }));
  if (index < 0 || index >= fitted.length) return fitted;
  const requested = Math.round(seconds);
  if (!Number.isInteger(requested)) return fitted;
  const total = fitted.reduce((sum, cut) => sum + cut.seconds, 0);
  const limit = maxSeconds && maxSeconds >= 1 ? Math.min(total, Math.floor(maxSeconds)) : total;
  const current = fitted[index]!.seconds;
  let takeRoom = 0;
  let giveRoom = 0;
  for (let cursor = 0; cursor < fitted.length; cursor += 1) {
    if (cursor === index) continue;
    takeRoom += fitted[cursor]!.seconds - 1;
    giveRoom += limit - fitted[cursor]!.seconds;
  }
  const nextSeconds = Math.max(1, Math.min(limit, current + takeRoom, Math.max(current - giveRoom, requested)));
  const delta = nextSeconds - current;
  if (delta === 0) return fitted;
  fitted[index]!.seconds = nextSeconds;
  let remaining = -delta;
  const order = [
    ...fitted.map((_, cursor) => cursor).filter((cursor) => cursor > index),
    ...fitted.map((_, cursor) => cursor).filter((cursor) => cursor < index).reverse(),
  ];
  for (const cursor of order) {
    if (remaining === 0) break;
    const cut = fitted[cursor]!;
    if (remaining > 0) {
      const add = Math.min(limit - cut.seconds, remaining);
      cut.seconds += add;
      remaining -= add;
    } else {
      const take = Math.min(cut.seconds - 1, -remaining);
      cut.seconds -= take;
      remaining += take;
    }
  }
  return fitted;
};

/** Smallest model duration that still covers the cut. Snaps up, because a shorter clip cannot fill the slot. */
export const filmSecondsFor = (cutSeconds: number, durations: readonly number[]) => {
  const sorted = [...durations].filter((duration) => duration > 0).sort((a, b) => a - b);
  const need = Math.max(1, Math.round(cutSeconds));
  if (sorted.length === 0) return need;
  const target = Math.max(need, sorted[0]!);
  return sorted.find((duration) => duration >= target) ?? sorted[sorted.length - 1]!;
};

/** Seconds actually sent to the model for these cuts. Short cuts snap up to a legal clip length. */
export const filmedSecondsForCuts = (
  length: number,
  durations: readonly number[],
  cuts: readonly { seconds: number; camera?: string; images?: number[] }[],
) => {
  const maxSeconds = durations.length > 0 ? Math.max(...durations) : undefined;
  return normalizeCuts(cuts, length, maxSeconds).reduce((sum, cut) => sum + filmSecondsFor(cut.seconds, durations), 0);
};

/** Equal model-legal cuts with no camera line. Used when the planner cannot run. */
export const fallbackCuts = (length: number, durations: readonly number[], maxSeconds: number): ShotCut[] =>
  normalizeCuts(
    planSegments(length, durations).map((seconds) => ({ seconds, camera: "" })),
    length,
    maxSeconds,
  );

const clipLine = (value: string | undefined, max: number) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Settings that decide a prompt-video shot plan. Editing any of them means the plan is out of date. */
export const promptPlanKey = (input: {
  prompt: string;
  length: number;
  tier: string;
  format: string;
  references: readonly string[];
  presetId: string;
  visualDirection: string;
  characterId: string;
}) =>
  JSON.stringify({
    prompt: input.prompt.trim(),
    length: input.length,
    tier: input.tier,
    format: input.format,
    references: input.references,
    presetId: input.presetId,
    visualDirection: input.visualDirection.trim(),
    characterId: input.characterId,
  });

export const sanitizePromptBrief = (brief: Partial<PromptBrief> | null | undefined): PromptBrief => ({
  subject: clipLine(brief?.subject, MAX_BRIEF_LINE),
  setting: clipLine(brief?.setting, MAX_BRIEF_LINE),
  director: clipLine(brief?.director, MAX_DIRECTOR_LINE),
  style: clipLine(brief?.style, MAX_BRIEF_LINE),
  mustKeep: clipLine(brief?.mustKeep, MAX_BRIEF_LINE),
  mustAvoid: clipLine(brief?.mustAvoid, MAX_BRIEF_LINE),
});

/** One role per uploaded picture. Missing pictures become a subject, then locations. */
export const normalizeAttachmentRoles = (
  roles: readonly { index: number; role: string }[] | undefined,
  referenceCount: number,
): AttachmentAssignment[] => {
  const count = Math.max(0, Math.min(MAX_REFERENCE_IMAGES, Math.floor(referenceCount)));
  const byIndex = new Map<number, AttachmentRole>();
  for (const role of roles ?? []) {
    const index = Math.round(role.index);
    if (index < 1 || index > count || !isAttachmentRole(role.role) || byIndex.has(index)) continue;
    byIndex.set(index, role.role);
  }
  return Array.from({ length: count }, (_, offset) => ({
    index: offset + 1,
    role: byIndex.get(offset + 1) ?? (offset === 0 ? "subject" : "location"),
  }));
};

/**
 * Turns a planner result into cuts that add up to the video.
 * An empty or missing result falls back to equal cuts and an empty brief.
 */
export const promptPlanFromOutput = (
  output: {
    subject?: string;
    setting?: string;
    director?: string;
    style?: string;
    mustKeep?: string;
    mustAvoid?: string;
    attachmentRoles?: { index: number; role: string }[];
    cuts?: { seconds: number; camera?: string; images?: number[] }[];
  } | null,
  input: { length: number; durations: readonly number[]; referenceCount: number },
): PromptShotPlan => {
  const maxSeconds =
    input.durations.length > 0 ? Math.max(...input.durations) : Math.max(1, Math.round(input.length));
  const attachmentRoles = normalizeAttachmentRoles(output?.attachmentRoles, input.referenceCount);
  const brief = output ? sanitizePromptBrief(output) : emptyPromptBrief();
  const rawCuts = output?.cuts ?? [];
  if (rawCuts.length === 0) {
    return { brief, attachmentRoles, cuts: fallbackCuts(input.length, input.durations, maxSeconds) };
  }
  const cuts = normalizeCuts(rawCuts, input.length, maxSeconds).map((cut) => {
    if (!cut.images) return cut;
    const images = cut.images.filter((index) => index <= input.referenceCount);
    return images.length > 0 ? { ...cut, images } : { seconds: cut.seconds, camera: cut.camera };
  });
  return { brief, attachmentRoles, cuts };
};

const roleSentence = (role: AttachmentRole, start: number, end: number) => {
  const label = start === end ? `Image ${start}` : `Images ${start}-${end}`;
  const plural = start !== end;
  if (role === "subject") {
    return `${label} ${plural ? "are" : "is"} the subject. Keep that exact subject.`;
  }
  if (role === "person") {
    return `${label} ${plural ? "are" : "is"} the person. Keep the same face, hair, and clothes.`;
  }
  if (role === "product") {
    return `${label} ${plural ? "are" : "is"} the product. Keep that exact product.`;
  }
  if (role === "location") {
    return `${label} ${plural ? "show" : "shows"} the location: match the set and light.`;
  }
  return `${label} ${plural ? "show" : "shows"} framing: copy the camera and composition, not the people.`;
};

const groupedRoleNote = (roles: readonly AttachmentRole[]) => {
  const parts: string[] = [];
  let index = 0;
  while (index < roles.length) {
    const role = roles[index]!;
    let end = index;
    while (end + 1 < roles.length && roles[end + 1] === role) end += 1;
    parts.push(roleSentence(role, index + 1, end + 1));
    index = end + 1;
  }
  return parts.join(" ");
};

/**
 * Pictures for one prompt-video shot, ordered subject, person, product, location, then framing.
 * The note numbers images in that same order, so the model can tell them apart.
 */
export const promptShotReferences = (input: {
  keys: readonly string[];
  roles: readonly { index: number; role: string }[];
  images?: readonly number[];
}): { keys: string[]; note: string } => {
  const count = input.keys.length;
  const chosen =
    input.images && input.images.length > 0 ? input.images : input.keys.map((_, index) => index + 1);
  const unique = [...new Set(chosen.map((index) => Math.round(index)))].filter(
    (index) => index >= 1 && index <= count,
  );
  const roleOf = (index: number): AttachmentRole => {
    const role = input.roles.find((item) => item.index === index)?.role;
    return isAttachmentRole(role) ? role : "subject";
  };
  const ordered = [...unique].sort((left, right) => {
    const byRole = ROLE_ORDER.indexOf(roleOf(left)) - ROLE_ORDER.indexOf(roleOf(right));
    return byRole !== 0 ? byRole : left - right;
  });
  return {
    keys: ordered.map((index) => input.keys[index - 1]!).filter((key) => key.trim().length > 0),
    note: groupedRoleNote(ordered.map((index) => roleOf(index))),
  };
};

/** One clip prompt: locks first, then the camera line, then which pictures to follow. */
export const promptShotPrompt = (input: {
  brief: PromptBrief;
  camera: string;
  referenceNote: string;
  /** Used when this cut has no camera line, so a fallback plan still films the request. */
  fallbackAction: string;
  continued: boolean;
}) => {
  const camera = input.camera.trim();
  const fallback = input.fallbackAction.trim();
  const action = camera
    ? `Camera: ${camera}`
    : input.continued && fallback
      ? `Continue the same scene. ${fallback}`
      : fallback;
  return [
    "One continuous shot. Do not change the location or cut to a new angle inside this clip.",
    input.brief.subject ? `Subject: ${input.brief.subject} Keep this subject the same in every shot.` : "",
    input.brief.setting ? `Scene: ${input.brief.setting}` : "",
    input.brief.director ? `Direction: ${input.brief.director}` : "",
    input.brief.mustKeep ? `Keep: ${input.brief.mustKeep}` : "",
    input.brief.mustAvoid ? `Avoid: ${input.brief.mustAvoid}` : "",
    action,
    input.referenceNote.trim(),
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n");
};
