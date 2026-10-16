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

const SPEND_TOOLS = new Set(["tool-create_video", "tool-start_production"]);

/** An assistant reply with a brief and no queued action yet, so Approve can go under it. */
export const hasApprovableBrief = (message: {
  role: string;
  parts: readonly { type: string; text?: string }[];
}) =>
  message.role === "assistant" &&
  message.parts.some((part) => part.type === "text" && Boolean(part.text) && BRIEF_FENCE.test(part.text ?? "")) &&
  !message.parts.some((part) => SPEND_TOOLS.has(part.type));

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
