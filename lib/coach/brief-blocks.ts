import { spendNeedsApproval } from "@/lib/billing/auto-approve";
import { videoJobCredits } from "@/lib/billing/estimate";
import { toolByName } from "@/lib/tools/registry";
import { proseWithoutVoiceNote } from "@/lib/coach/voice-notes";

export interface CoachBrief {
  mode: string;
  format: string;
  length: string;
  tier: string;
  preset: string;
  hook: string;
  beats: string[];
  vo: string;
  cta: string;
}

const BRIEF_FENCE = /```brief\s*([\s\S]*?)```/i;

/** Sent when the person presses Approve under a brief. The Coach treats it as the go-ahead. */
export const BRIEF_APPROVAL_TEXT = "Approved. Queue it exactly as written in the brief.";

const queuesSpend = (type: string) => {
  if (!type.startsWith("tool-")) return false;
  return toolByName(type.slice("tool-".length))?.effects.spendsCredits === true;
};

/** An assistant reply with a brief and no queued action yet, so Approve can go under it. */
export const hasApprovableBrief = (message: {
  role: string;
  parts: readonly { type: string; text?: string }[];
}) =>
  message.role === "assistant" &&
  message.parts.some((part) => part.type === "text" && Boolean(part.text) && BRIEF_FENCE.test(part.text ?? "")) &&
  !message.parts.some((part) => queuesSpend(part.type));

export const briefFromParts = (parts: readonly { type: string; text?: string }[]) => {
  for (const part of parts) {
    if (part.type !== "text" || !part.text) continue;
    const brief = splitCoachContent(part.text).brief;
    if (brief) return brief;
  }
  return null;
};

/** Credits the brief card quotes for a Create video. A production start is priced separately, at one credit. */
export const briefCredits = (brief: CoachBrief) => {
  const length = Number.parseInt(brief.length, 10);
  if (!Number.isFinite(length) || length <= 0) return 0;
  return videoJobCredits({ mode: brief.mode, tier: brief.tier, length });
};

/** A brief at 200 credits or more waits for Approve. A cheaper brief can start on its own. */
export const briefNeedsApproval = (brief: CoachBrief) => spendNeedsApproval(briefCredits(brief));

/** The go-ahead the Approve button sends. It is for the model, not a line to show in the chat. */
export const isBriefApprovalMessage = (message: {
  role: string;
  parts: readonly { type: string; text?: string }[];
}) =>
  message.role === "user" &&
  message.parts.length > 0 &&
  message.parts.every((part) => {
    if (part.type !== "text" || !part.text) return false;
    const prose = proseWithoutVoiceNote(part.text).trim();
    return prose === "" || prose === BRIEF_APPROVAL_TEXT;
  });

export const splitCoachContent = (text: string) => {
  const match = text.match(BRIEF_FENCE);
  if (!match) return { prose: text.trim(), brief: null as CoachBrief | null };
  const prose = `${text.slice(0, match.index).trim()}\n\n${text.slice((match.index ?? 0) + match[0].length).trim()}`.trim();
  return { prose, brief: parseBrief(match[1] ?? "") };
};

const EMPTY_VALUES = new Set(["none", "n/a", "na", "-", "—", "off"]);

const textOrEmpty = (value: string | undefined) => {
  const text = value?.trim() ?? "";
  return EMPTY_VALUES.has(text.toLowerCase()) ? "" : text;
};

const parseBrief = (body: string): CoachBrief => {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    fields[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return {
    mode: fields.mode ?? "prompt",
    format: fields.format ?? "9:16",
    length: fields.length ?? "30",
    tier: fields.tier ?? "pro",
    preset: fields.preset ?? "auto",
    hook: textOrEmpty(fields.hook),
    beats: (fields.beats ?? "")
      .split("|")
      .map((beat) => beat.trim())
      .filter(Boolean),
    vo: textOrEmpty(fields.vo),
    cta: textOrEmpty(fields.cta),
  };
};
